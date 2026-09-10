/**
 * Copyright (c) 2025, Circle Internet Group, Inc. All rights reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use client";

import { useState } from "react";
import {
  http,
  encodeFunctionData,
  type Hex,
  TransactionExecutionError,
  parseUnits,
  createPublicClient,
  formatUnits,
  toHex,
  hexToBytes,
} from "viem";

import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import {
  SupportedChainId,
  CHAIN_CONFIGS,
  SOLANA_RPC_ENDPOINT,
  IRIS_API_URL,
  supportsFastTransferAsSource,
} from "@/lib/chains";
import {
  createDepositForBurnInstruction,
  createReceiveMessageInstruction,
  decodeBurnTokenFromMessage,
  decodeNonceFromMessage,
  getAssociatedTokenAddress,
  getDepositForBurnPdas,
  getReceiveMessagePdas,
  getSolanaConnection,
  getTokenAccountAmount,
  hexToBytes as solanaHexToBytes,
  sendSolanaTransaction,
} from "@/lib/solana-utils";
import {
  ensureEvmChain,
  getEvmWalletClient,
  type AptosWalletConnection,
  type EvmClient,
  type SolanaWalletConnection,
  type SuiWalletConnection,
  type WalletConnections,
} from "@/lib/browser-wallets";

export type TransferStep =
  | "idle"
  | "approving"
  | "burning"
  | "waiting-attestation"
  | "minting"
  | "completed"
  | "error";

interface AttestationResponse {
  message: Hex;
  attestation: Hex;
  status: string;
}

interface FastTransferFeeResponse {
  finalityThreshold?: number;
  minimumFee: number | string;
}

const DEFAULT_DECIMALS = 6;
const FAST_FINALITY_THRESHOLD = 1000;
const STANDARD_FINALITY_THRESHOLD = 2000;
const ATTESTATION_POLL_INTERVAL_MS = 5000;
const MINT_MAX_RETRIES = 3;
const MINT_RETRY_BASE_DELAY_MS = 2000;
const GAS_BUFFER_PERCENT = 120n;
const FAST_FEE_BUFFER_PERCENT = 120n;
// A zero destination caller allows any address to call receiveMessage.
const BYTES32_ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

export function useCrossChainTransfer() {
  const [currentStep, setCurrentStep] = useState<TransferStep>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // CCTP Transfer Flow
  // The core transfer is a 4-step process: Approve → Burn → Attest → Mint
  // ---------------------------------------------------------------------------

  const executeTransfer = async (
    sourceChainId: number,
    destinationChainId: number,
    amount: string,
    transferType: "fast" | "standard",
    wallets: WalletConnections,
  ) => {
    try {
      const numericAmount = parseUnits(amount, DEFAULT_DECIMALS);
      const sourceEcosystem =
        CHAIN_CONFIGS[sourceChainId as SupportedChainId].ecosystem;
      const destinationEcosystem =
        CHAIN_CONFIGS[destinationChainId as SupportedChainId].ecosystem;

      const sourceClient = getClients(sourceChainId, wallets);
      const destinationClient = getClients(destinationChainId, wallets);
      const defaultDestination = getDestinationAddress(
        destinationChainId,
        wallets,
      );

      // Step 1: Approve
      switch (sourceEcosystem) {
        case "solana":
          await approveSolanaUsdc();
          break;
        case "aptos":
          await approveAptosUsdc();
          break;
        case "sui":
          await approveSuiUsdc();
          break;
        case "evm":
          await approveEvmUsdc(
            sourceClient as EvmClient,
            sourceChainId,
            numericAmount,
            wallets,
          );
          break;
        case "stellar":
          throw new Error("stellar source transfers are not implemented yet");
      }

      // Step 2: Burn
      let burnTx: string;
      switch (sourceEcosystem) {
        case "solana":
          burnTx = await burnSolanaUsdc(
            sourceClient as SolanaWalletConnection,
            numericAmount,
            destinationChainId,
            defaultDestination,
            transferType,
          );
          break;
        case "aptos":
          burnTx = await burnAptosUsdc(
            sourceClient as AptosWalletConnection,
            numericAmount,
            destinationChainId,
            defaultDestination,
            transferType,
          );
          break;
        case "sui":
          burnTx = await burnSuiUsdc(
            sourceClient as SuiWalletConnection,
            numericAmount,
            destinationChainId,
            defaultDestination,
            transferType,
          );
          break;
        case "evm":
          burnTx = await burnEvmUsdc(
            sourceClient as EvmClient,
            sourceChainId,
            numericAmount,
            destinationChainId,
            defaultDestination,
            transferType,
            wallets,
          );
          break;
        default:
          throw new Error(`Unsupported source ecosystem: ${sourceEcosystem}`);
      }

      // Step 3: Retrieve attestation
      const attestation = await retrieveAttestation(burnTx, sourceChainId);

      // Step 4: Mint
      switch (destinationEcosystem) {
        case "solana":
          await mintSolanaUsdc(
            destinationClient as SolanaWalletConnection,
            attestation,
          );
          break;
        case "aptos":
          await mintAptosUsdc(
            destinationClient as AptosWalletConnection,
            attestation,
          );
          break;
        case "sui":
          await mintSuiUsdc(
            destinationClient as SuiWalletConnection,
            attestation,
          );
          break;
        case "evm":
          await mintEvmUsdc(
            destinationClient as EvmClient,
            destinationChainId,
            attestation,
            wallets,
          );
          break;
        case "stellar":
          throw new Error(
            "stellar destination transfers are not implemented yet",
          );
      }
    } catch (error) {
      setCurrentStep("error");
      setError(getErrorMessage(error));
    }
  };

  // ---------------------------------------------------------------------------
  // Step 1: Approve — Grant TokenMessenger permission to spend USDC
  // ---------------------------------------------------------------------------

  const approveEvmUsdc = async (
    client: EvmClient,
    sourceChainId: number,
    amount: bigint,
    wallets: WalletConnections,
  ) => {
    setCurrentStep("approving");
    addLog("Approving USDC transfer...");

    await switchEvmWalletToChain(sourceChainId, wallets);
    if (!client.account) {
      throw new Error("Connect an EVM wallet to continue.");
    }
    const tx = await client.sendTransaction({
      account: client.account,
      chain: client.chain,
      to: CHAIN_CONFIGS[sourceChainId as SupportedChainId]
        .usdcAddress as `0x${string}`,
      data: encodeFunctionData({
        abi: [
          {
            type: "function",
            name: "approve",
            stateMutability: "nonpayable",
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [{ name: "", type: "bool" }],
          },
        ],
        functionName: "approve",
        args: [
          CHAIN_CONFIGS[sourceChainId as SupportedChainId]
            .tokenMessenger as `0x${string}`,
          amount,
        ],
      }),
    });

    addLog(`USDC Approval Tx: ${tx}`);
    const receipt = await createPublicClient({
      chain: CHAIN_CONFIGS[sourceChainId as SupportedChainId].viemChain,
      transport: http(),
    }).waitForTransactionReceipt({ hash: tx });
    if (receipt.status !== "success") {
      throw new Error(`Approve transaction reverted: ${tx}`);
    }
    return tx;
  };

  // SPL tokens don't require explicit approval like ERC20; the burn handles authorization
  const approveSolanaUsdc = async () => {
    setCurrentStep("approving");
    return "solana-approve-placeholder";
  };

  // Aptos deposit_for_burn script withdraws from the primary fungible store (no separate approve)
  const approveAptosUsdc = async () => {
    setCurrentStep("approving");
    return "aptos-approve-placeholder";
  };

  // Sui burn redeems SIP-58 funds inside the PTB (no separate approve)
  const approveSuiUsdc = async () => {
    setCurrentStep("approving");
    return "sui-approve-placeholder";
  };

  // ---------------------------------------------------------------------------
  // Step 2: Burn — Burn USDC on source chain via TokenMessenger.depositForBurn
  // ---------------------------------------------------------------------------

  const burnEvmUsdc = async (
    client: EvmClient,
    sourceChainId: number,
    amount: bigint,
    destinationChainId: number,
    destinationAddress: string,
    transferType: "fast" | "standard",
    wallets: WalletConnections,
  ) => {
    setCurrentStep("burning");
    addLog("Burning USDC...");

    await switchEvmWalletToChain(sourceChainId, wallets);
    if (!client.account) {
      throw new Error("Connect an EVM wallet to continue.");
    }
    const { maxFee, minFinalityThreshold } = await resolveBurnFeeParams(
      sourceChainId as SupportedChainId,
      destinationChainId as SupportedChainId,
      amount,
      transferType,
    );

    let mintRecipient: string;
    if (
      CHAIN_CONFIGS[destinationChainId as SupportedChainId].ecosystem ===
      "solana"
    ) {
      const usdcMint = new PublicKey(
        CHAIN_CONFIGS[SupportedChainId.SOLANA_DEVNET].usdcAddress as string,
      );
      const destinationWallet = new PublicKey(destinationAddress);
      const tokenAccount = await getAssociatedTokenAddress(
        usdcMint,
        destinationWallet,
      );
      mintRecipient = toHex(bs58.decode(tokenAccount.toBase58()));
    } else {
      mintRecipient = `0x${destinationAddress
        .replace(/^0x/, "")
        .padStart(64, "0")}`;
    }

    const tx = await client.sendTransaction({
      account: client.account,
      chain: client.chain,
      to: CHAIN_CONFIGS[sourceChainId as SupportedChainId]
        .tokenMessenger as `0x${string}`,
      data: encodeFunctionData({
        abi: [
          {
            type: "function",
            name: "depositForBurn",
            stateMutability: "nonpayable",
            inputs: [
              { name: "amount", type: "uint256" },
              { name: "destinationDomain", type: "uint32" },
              { name: "mintRecipient", type: "bytes32" },
              { name: "burnToken", type: "address" },
              { name: "destinationCaller", type: "bytes32" },
              { name: "maxFee", type: "uint256" },
              { name: "minFinalityThreshold", type: "uint32" },
            ],
            outputs: [],
          },
        ],
        functionName: "depositForBurn",
        args: [
          amount,
          CHAIN_CONFIGS[destinationChainId as SupportedChainId]
            .destinationDomain,
          mintRecipient as Hex,
          CHAIN_CONFIGS[sourceChainId as SupportedChainId]
            .usdcAddress as `0x${string}`,
          BYTES32_ZERO,
          maxFee,
          minFinalityThreshold,
        ],
      }),
    });

    addLog(`Burn Tx: ${tx}`);
    const receipt = await createPublicClient({
      chain: CHAIN_CONFIGS[sourceChainId as SupportedChainId].viemChain,
      transport: http(),
    }).waitForTransactionReceipt({ hash: tx });
    if (receipt.status !== "success") {
      throw new Error(`Burn transaction reverted: ${tx}`);
    }
    return tx;
  };

  const burnSolanaUsdc = async (
    wallet: SolanaWalletConnection,
    amount: bigint,
    destinationChainId: number,
    destinationAddress: string,
    transferType: "fast" | "standard",
  ) => {
    setCurrentStep("burning");
    addLog("Burning Solana USDC...");

    const walletPublicKey = wallet.publicKey;
    if (!walletPublicKey) {
      throw new Error("Connect a Solana wallet to continue.");
    }

    const connection = getSolanaConnection(SOLANA_RPC_ENDPOINT);
    const usdcMint = new PublicKey(
      CHAIN_CONFIGS[SupportedChainId.SOLANA_DEVNET].usdcAddress as string,
    );
    const destinationDomain =
      CHAIN_CONFIGS[destinationChainId as SupportedChainId].destinationDomain;

    const pdas = await getDepositForBurnPdas(
      usdcMint,
      destinationDomain,
      walletPublicKey,
    );
    const messageSentEventAccount = await Keypair.generate();
    const userTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      walletPublicKey,
    );

    let mintRecipient: PublicKey;
    if (
      CHAIN_CONFIGS[destinationChainId as SupportedChainId].ecosystem ===
      "solana"
    ) {
      mintRecipient = new PublicKey(destinationAddress);
    } else {
      // EVM (20-byte) or Aptos/Sui (32-byte) → left-padded bytes32 → PublicKey
      const padded = `0x${destinationAddress
        .replace(/^0x/, "")
        .toLowerCase()
        .padStart(64, "0")}`;
      mintRecipient = new PublicKey(hexToBytes(padded as Hex));
    }

    // A zero destinationCaller lets any address deliver the message on the
    // destination chain, matching the EVM (BYTES32_ZERO), Aptos and Sui (0x0)
    // burn paths.
    const destinationCaller = PublicKey.default;
    const { maxFee, minFinalityThreshold } = await resolveBurnFeeParams(
      SupportedChainId.SOLANA_DEVNET,
      destinationChainId as SupportedChainId,
      amount,
      transferType,
    );

    const depositForBurnTx = await sendSolanaTransaction({
      connection,
      wallet,
      instructions: [
        createDepositForBurnInstruction({
          amount,
          destinationDomain,
          mintRecipient,
          destinationCaller,
          maxFee,
          minFinalityThreshold,
          owner: walletPublicKey,
          userTokenAccount,
          usdcMint,
          messageSentEventAccount: messageSentEventAccount.publicKey,
          pdas,
        }),
      ],
      signers: [messageSentEventAccount],
    });

    addLog(`Solana burn transaction: ${depositForBurnTx}`);
    return depositForBurnTx;
  };

  const burnAptosUsdc = async (
    wallet: AptosWalletConnection,
    amount: bigint,
    destinationChainId: number,
    destinationAddress: string,
    transferType: "fast" | "standard",
  ) => {
    setCurrentStep("burning");
    addLog("Burning Aptos USDC...");

    const {
      APTOS_DEPOSIT_FOR_BURN_SCRIPT_URL,
      signAndSubmitAptosScript,
      toBytes32AccountAddress,
    } = await import("@/lib/aptos-utils");
    const { AccountAddress, U32, U64 } = await import("@aptos-labs/ts-sdk");

    const destinationConfig =
      CHAIN_CONFIGS[destinationChainId as SupportedChainId];
    let mintRecipient: ReturnType<typeof toBytes32AccountAddress>;
    if (destinationConfig.ecosystem === "solana") {
      const usdcMint = new PublicKey(
        CHAIN_CONFIGS[SupportedChainId.SOLANA_DEVNET].usdcAddress as string,
      );
      const tokenAccount = await getAssociatedTokenAddress(
        usdcMint,
        new PublicKey(destinationAddress),
      );
      mintRecipient = toBytes32AccountAddress(
        toHex(bs58.decode(tokenAccount.toBase58())),
      );
    } else {
      mintRecipient = toBytes32AccountAddress(destinationAddress);
    }

    const { maxFee, minFinalityThreshold } = await resolveBurnFeeParams(
      SupportedChainId.APTOS_TESTNET,
      destinationChainId as SupportedChainId,
      amount,
      transferType,
    );

    const burnTx = await signAndSubmitAptosScript(wallet.wallet, wallet.address, {
      scriptUrl: APTOS_DEPOSIT_FOR_BURN_SCRIPT_URL,
      functionArguments: [
        new U64(amount),
        new U32(destinationConfig.destinationDomain),
        mintRecipient,
        AccountAddress.from("0x0"),
        AccountAddress.from(
          CHAIN_CONFIGS[SupportedChainId.APTOS_TESTNET].usdcAddress as string,
        ),
        new U64(maxFee),
        new U32(minFinalityThreshold),
      ],
    });

    addLog(`Aptos burn transaction: ${burnTx}`);
    return burnTx;
  };

  const burnSuiUsdc = async (
    wallet: SuiWalletConnection,
    amount: bigint,
    destinationChainId: number,
    destinationAddress: string,
    transferType: "fast" | "standard",
  ) => {
    setCurrentStep("burning");
    addLog("Burning Sui USDC...");

    const {
      buildDepositForBurnTransaction,
      signAndExecuteSuiTransaction,
    } = await import("@/lib/sui-utils");

    const destinationConfig =
      CHAIN_CONFIGS[destinationChainId as SupportedChainId];
    let mintRecipient = destinationAddress;
    if (destinationConfig.ecosystem === "solana") {
      const usdcMint = new PublicKey(
        CHAIN_CONFIGS[SupportedChainId.SOLANA_DEVNET].usdcAddress as string,
      );
      const tokenAccount = await getAssociatedTokenAddress(
        usdcMint,
        new PublicKey(destinationAddress),
      );
      mintRecipient = toHex(bs58.decode(tokenAccount.toBase58()));
    }

    const { maxFee, minFinalityThreshold } = await resolveBurnFeeParams(
      SupportedChainId.SUI_TESTNET,
      destinationChainId as SupportedChainId,
      amount,
      transferType,
    );

    const burnTx = await signAndExecuteSuiTransaction(
      wallet,
      buildDepositForBurnTransaction({
        amount,
        destinationDomain: destinationConfig.destinationDomain,
        mintRecipient,
        maxFee,
        minFinalityThreshold,
      }),
    );

    addLog(`Sui burn transaction: ${burnTx}`);
    return burnTx;
  };

  // ---------------------------------------------------------------------------
  // Step 3: Attest — Poll Circle's IRIS API until attestation is complete
  // ---------------------------------------------------------------------------

  const retrieveAttestation = async (
    transactionHash: string,
    sourceChainId: number,
  ): Promise<AttestationResponse> => {
    setCurrentStep("waiting-attestation");
    addLog("Retrieving attestation...");

    const url = `${IRIS_API_URL}/v2/messages/${CHAIN_CONFIGS[sourceChainId as SupportedChainId].destinationDomain}?transactionHash=${transactionHash}`;

    while (true) {
      const response = await fetch(url);
      if (response.status === 404) {
        await new Promise((resolve) =>
          setTimeout(resolve, ATTESTATION_POLL_INTERVAL_MS),
        );
        continue;
      }
      if (!response.ok) {
        throw new Error(
          `Attestation request failed with status ${response.status}`,
        );
      }
      const data = await response.json();
      if (data?.messages?.[0]?.status === "complete") {
        addLog("Attestation retrieved");
        return data.messages[0] as AttestationResponse;
      }
      addLog("Waiting for attestation...");
      await new Promise((resolve) =>
        setTimeout(resolve, ATTESTATION_POLL_INTERVAL_MS),
      );
    }
  };

  // ---------------------------------------------------------------------------
  // Step 4: Mint — Deliver attestation to destination chain's MessageTransmitter
  // ---------------------------------------------------------------------------

  const mintEvmUsdc = async (
    client: EvmClient,
    destinationChainId: number,
    attestation: AttestationResponse,
    wallets: WalletConnections,
  ) => {
    let retries = 0;
    setCurrentStep("minting");
    addLog("Minting USDC...");

    while (retries < MINT_MAX_RETRIES) {
      try {
        await switchEvmWalletToChain(destinationChainId, wallets);
        if (!client.account) {
          throw new Error("Connect an EVM wallet to continue.");
        }
        const publicClient = createPublicClient({
          chain:
            CHAIN_CONFIGS[destinationChainId as SupportedChainId].viemChain,
          transport: http(),
        });
        const contractConfig = {
          address: CHAIN_CONFIGS[destinationChainId as SupportedChainId]
            .messageTransmitter as `0x${string}`,
          abi: [
            {
              type: "function",
              name: "receiveMessage",
              stateMutability: "nonpayable",
              inputs: [
                { name: "message", type: "bytes" },
                { name: "attestation", type: "bytes" },
              ],
              outputs: [],
            },
          ] as const,
        };

        const gasEstimate = await publicClient.estimateContractGas({
          ...contractConfig,
          functionName: "receiveMessage",
          args: [attestation.message, attestation.attestation],
          account: client.account,
        });

        const gasWithBuffer = (gasEstimate * GAS_BUFFER_PERCENT) / 100n;
        addLog(`Gas limit: ${gasWithBuffer.toString()}`);

        const tx = await client.sendTransaction({
          account: client.account,
          chain: client.chain,
          to: contractConfig.address,
          data: encodeFunctionData({
            ...contractConfig,
            functionName: "receiveMessage",
            args: [attestation.message, attestation.attestation],
          }),
          gas: gasWithBuffer,
        });

        addLog(`Mint Tx: ${tx}`);
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: tx,
        });
        if (receipt.status !== "success") {
          throw new Error(`Mint transaction reverted: ${tx}`);
        }
        addLog(`Bridge completed successfully`);
        setCurrentStep("completed");
        break;
      } catch (err) {
        if (
          err instanceof TransactionExecutionError &&
          retries < MINT_MAX_RETRIES - 1
        ) {
          retries++;
          addLog(`Retry ${retries}/${MINT_MAX_RETRIES}...`);
          await new Promise((resolve) =>
            setTimeout(resolve, MINT_RETRY_BASE_DELAY_MS * retries),
          );
          continue;
        }
        throw err;
      }
    }
  };

  const mintSolanaUsdc = async (
    wallet: SolanaWalletConnection,
    attestation: AttestationResponse,
  ) => {
    setCurrentStep("minting");
    addLog("Minting Solana USDC...");

    try {
      const walletPublicKey = wallet.publicKey;
      if (!walletPublicKey) {
        throw new Error("Connect a Solana wallet to continue.");
      }

      const connection = getSolanaConnection(SOLANA_RPC_ENDPOINT);
      const usdcMint = new PublicKey(
        CHAIN_CONFIGS[SupportedChainId.SOLANA_DEVNET].usdcAddress as string,
      );
      const messageHex = attestation.message;
      const attestationHex = attestation.attestation;
      const nonce = decodeNonceFromMessage(messageHex);
      const messageBytes = solanaHexToBytes(messageHex);
      const sourceDomain = new DataView(
        messageBytes.buffer,
        messageBytes.byteOffset,
        messageBytes.byteLength,
      ).getUint32(4, false);

      const pdas = await getReceiveMessagePdas(
        connection,
        usdcMint,
        decodeBurnTokenFromMessage(messageHex),
        sourceDomain.toString(),
        nonce,
      );
      const userTokenAccount = await getAssociatedTokenAddress(
        usdcMint,
        walletPublicKey,
      );

      const receiveMessageTx = await sendSolanaTransaction({
        connection,
        wallet,
        instructions: [
          createReceiveMessageInstruction({
            payer: walletPublicKey,
            message: messageBytes,
            attestation: solanaHexToBytes(attestationHex),
            pdas,
            userTokenAccount,
          }),
        ],
      });

      addLog(`Solana mint transaction: ${receiveMessageTx}`);
      setCurrentStep("completed");
      return receiveMessageTx;
    } catch (err) {
      console.error("Full Solana mint error:", err);
      throw err;
    }
  };

  const mintAptosUsdc = async (
    wallet: AptosWalletConnection,
    attestation: AttestationResponse,
  ) => {
    setCurrentStep("minting");
    addLog("Minting Aptos USDC...");

    const {
      APTOS_RECEIVE_MESSAGE_SCRIPT_URL,
      signAndSubmitAptosScript,
    } = await import("@/lib/aptos-utils");
    const { MoveVector } = await import("@aptos-labs/ts-sdk");

    const receiveTx = await signAndSubmitAptosScript(
      wallet.wallet,
      wallet.address,
      {
        scriptUrl: APTOS_RECEIVE_MESSAGE_SCRIPT_URL,
        functionArguments: [
          MoveVector.U8(hexToBytes(attestation.message)),
          MoveVector.U8(hexToBytes(attestation.attestation)),
        ],
      },
    );

    addLog(`Aptos mint transaction: ${receiveTx}`);
    setCurrentStep("completed");
    return receiveTx;
  };

  const mintSuiUsdc = async (
    wallet: SuiWalletConnection,
    attestation: AttestationResponse,
  ) => {
    setCurrentStep("minting");
    addLog("Minting Sui USDC...");

    const {
      buildReceiveMessageTransaction,
      foldMintedUsdcIntoAddressBalance,
      signAndExecuteSuiTransaction,
    } = await import("@/lib/sui-utils");

    const receiveTx = await signAndExecuteSuiTransaction(
      wallet,
      buildReceiveMessageTransaction({
        message: hexToBytes(attestation.message),
        attestation: hexToBytes(attestation.attestation),
      }),
    );
    addLog(`Sui mint transaction: ${receiveTx}`);

    try {
      const foldTx = await foldMintedUsdcIntoAddressBalance(wallet, receiveTx);
      if (foldTx) {
        addLog(`Sui SIP-58 fold transaction: ${foldTx}`);
      }
    } catch (foldError) {
      console.error("Sui SIP-58 fold skipped:", foldError);
      addLog("Sui mint succeeded; SIP-58 fold skipped (Coin may remain as object)");
    }

    setCurrentStep("completed");
    return receiveTx;
  };

  // ---------------------------------------------------------------------------
  // Helpers — Balance checks, client setup, key management
  // ---------------------------------------------------------------------------

  const getBalance = async (
    chainId: SupportedChainId,
    wallets: WalletConnections,
  ) => {
    switch (CHAIN_CONFIGS[chainId].ecosystem) {
      case "solana":
        return getSolanaBalance(chainId, wallets);
      case "evm":
        return getEvmBalance(chainId, wallets);
      case "aptos":
        return getAptosBalance(wallets);
      case "sui":
        return getSuiBalance(wallets);
      case "stellar":
        return "0";
    }
  };

  const getAptosBalance = async (wallets: WalletConnections) => {
    if (!wallets.aptos) {
      return "0";
    }
    const { getAptosUsdcBalance } = await import("@/lib/aptos-utils");
    return getAptosUsdcBalance(wallets.aptos.address);
  };

  const getSuiBalance = async (wallets: WalletConnections) => {
    if (!wallets.sui) {
      return "0";
    }
    const { getSuiUsdcBalance } = await import("@/lib/sui-utils");
    return getSuiUsdcBalance(wallets.sui.address);
  };

  const getSolanaBalance = async (
    chainId: SupportedChainId,
    wallets: WalletConnections,
  ) => {
    const solanaWallet = wallets.solana;
    if (!solanaWallet) {
      return "0";
    }

    const connection = getSolanaConnection();
    const usdcMint = new PublicKey(
      CHAIN_CONFIGS[chainId].usdcAddress as string,
    );
    const associatedTokenAddress = await getAssociatedTokenAddress(
      usdcMint,
      solanaWallet.publicKey,
    );
    const amount = await getTokenAccountAmount(
      connection,
      associatedTokenAddress,
    );
    if (amount === null) {
      return "0";
    }
    return (Number(amount) / Math.pow(10, DEFAULT_DECIMALS)).toString();
  };

  const getEvmBalance = async (
    chainId: SupportedChainId,
    wallets: WalletConnections,
  ) => {
    const evmWallet = wallets.evm;
    if (!evmWallet) {
      return "0";
    }

    const publicClient = createPublicClient({
      chain: CHAIN_CONFIGS[chainId as SupportedChainId].viemChain,
      transport: http(),
    });

    const balance = await publicClient.readContract({
      address: CHAIN_CONFIGS[chainId].usdcAddress as `0x${string}`,
      abi: [
        {
          constant: true,
          inputs: [{ name: "_owner", type: "address" }],
          name: "balanceOf",
          outputs: [{ name: "balance", type: "uint256" }],
          payable: false,
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "balanceOf",
      args: [evmWallet.address],
    });

    const formattedBalance = formatUnits(balance, DEFAULT_DECIMALS);
    return formattedBalance;
  };

  const getClients = (
    chainId: SupportedChainId,
    wallets: WalletConnections,
  ) => {
    switch (CHAIN_CONFIGS[chainId].ecosystem) {
      case "solana": {
        const wallet = wallets.solana;
        if (!wallet) {
          throw new Error("Connect a Solana wallet to continue.");
        }
        return wallet;
      }
      case "evm": {
        const wallet = wallets.evm;
        if (!wallet) {
          throw new Error("Connect an EVM wallet to continue.");
        }
        return getEvmWalletClient(wallet, chainId);
      }
      case "aptos": {
        const wallet = wallets.aptos;
        if (!wallet) {
          throw new Error("Connect an Aptos wallet to continue.");
        }
        return wallet;
      }
      case "sui": {
        const wallet = wallets.sui;
        if (!wallet) {
          throw new Error("Connect a Sui wallet to continue.");
        }
        return wallet;
      }
      case "stellar":
        throw new Error("stellar wallets are not implemented yet");
    }
  };

  /**
   * Resolve maxFee + minFinalityThreshold for depositForBurn.
   * Fast Transfer is source-only (CCTP support matrix). Standard is always
   * available. When Fast is requested on an N/A source, or Iris fee quote
   * fails, fall back to Standard (maxFee 0, finality 2000).
   */
  const resolveBurnFeeParams = async (
    sourceChainId: SupportedChainId,
    destinationChainId: SupportedChainId,
    amount: bigint,
    transferType: "fast" | "standard",
  ) => {
    const wantFast =
      transferType === "fast" && supportsFastTransferAsSource(sourceChainId);

    if (transferType === "fast" && !wantFast) {
      addLog(
        `Fast Transfer is not available from ${CHAIN_CONFIGS[sourceChainId].name}; using Standard Transfer`,
      );
    }

    if (!wantFast) {
      return {
        maxFee: 0n,
        minFinalityThreshold: STANDARD_FINALITY_THRESHOLD,
      };
    }

    try {
      const maxFee = await getBufferedFastTransferFee(
        sourceChainId,
        destinationChainId,
        amount,
      );
      return {
        maxFee,
        minFinalityThreshold: FAST_FINALITY_THRESHOLD,
      };
    } catch (error) {
      addLog(
        `Fast fee unavailable (${getErrorMessage(error)}); falling back to Standard Transfer`,
      );
      return {
        maxFee: 0n,
        minFinalityThreshold: STANDARD_FINALITY_THRESHOLD,
      };
    }
  };

  const getBufferedFastTransferFee = async (
    sourceChainId: SupportedChainId,
    destinationChainId: SupportedChainId,
    amount: bigint,
  ) => {
    const sourceDomain = CHAIN_CONFIGS[sourceChainId].destinationDomain;
    const destinationDomain =
      CHAIN_CONFIGS[destinationChainId].destinationDomain;
    const feeUrl = `${IRIS_API_URL}/v2/burn/USDC/fees/${sourceDomain}/${destinationDomain}`;

    const response = await fetch(feeUrl);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Fee request failed with status ${response.status}${body ? `: ${body}` : ""}`,
      );
    }

    const feePayload = (await response.json()) as FastTransferFeeResponse[];
    const feeEntry =
      feePayload.find(
        (entry) => entry.finalityThreshold === FAST_FINALITY_THRESHOLD,
      ) ?? feePayload[0];
    if (!feeEntry) {
      throw new Error("No fee returned for this route");
    }

    const minimumFeeBpsHundredths = parseFeeBps(feeEntry.minimumFee);
    const protocolFee = (amount * minimumFeeBpsHundredths) / 1_000_000n;
    const bufferedFee = (protocolFee * FAST_FEE_BUFFER_PERCENT) / 100n;

    addLog(
      `Fast transfer fee cap: ${formatUnits(bufferedFee, DEFAULT_DECIMALS)} USDC`,
    );

    return bufferedFee;
  };

  const parseFeeBps = (minimumFee: number | string) => {
    const minimumFeeString = String(minimumFee);
    const [whole = "0", fraction = ""] = minimumFeeString.split(".");
    const paddedFraction = `${fraction}00`.slice(0, 2);
    return BigInt(`${whole}${paddedFraction}`);
  };

  const addLog = (message: string) =>
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    const e = error as { message?: string };
    if (e.message) return e.message;
    if (typeof error === "string") return error;
    return "Unknown error";
  };

  const getRequiredEvmWallet = (wallets: WalletConnections) => {
    if (!wallets.evm) {
      throw new Error("Connect an EVM wallet to continue.");
    }
    return wallets.evm;
  };

  const getRequiredSolanaWallet = (wallets: WalletConnections) => {
    if (!wallets.solana) {
      throw new Error("Connect a Solana wallet to continue.");
    }
    return wallets.solana;
  };

  const getDestinationAddress = (
    chainId: number,
    wallets: WalletConnections,
  ) => {
    switch (CHAIN_CONFIGS[chainId as SupportedChainId].ecosystem) {
      case "solana":
        return getRequiredSolanaWallet(wallets).address;
      case "evm":
        return getRequiredEvmWallet(wallets).address;
      case "aptos":
        if (!wallets.aptos) {
          throw new Error("Connect an Aptos wallet to continue.");
        }
        return wallets.aptos.address;
      case "sui":
        if (!wallets.sui) {
          throw new Error("Connect a Sui wallet to continue.");
        }
        return wallets.sui.address;
      case "stellar":
        if (!wallets.stellar) {
          throw new Error("Connect a Stellar wallet to continue.");
        }
        return wallets.stellar.address;
    }
  };

  const switchEvmWalletToChain = async (
    chainId: number,
    wallets: WalletConnections,
  ) => {
    const evmWallet = getRequiredEvmWallet(wallets);
    try {
      await ensureEvmChain(evmWallet.provider, chainId as SupportedChainId);
    } catch (error: unknown) {
      const e = error as { code?: number; message?: string };
      if (e.code === 4001 && e.message) {
        throw new Error(e.message);
      }
      throw error;
    }
  };

  const reset = () => {
    setCurrentStep("idle");
    setLogs([]);
    setError(null);
  };

  return {
    currentStep,
    logs,
    error,
    executeTransfer,
    getBalance,
    reset,
  };
}
