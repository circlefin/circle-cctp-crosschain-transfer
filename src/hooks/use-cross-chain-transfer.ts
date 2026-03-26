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

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import { BN } from "@coral-xyz/anchor";
import {
  SupportedChainId,
  CHAIN_CONFIGS,
  SOLANA_RPC_ENDPOINT,
  IRIS_API_URL,
} from "@/lib/chains";
import {
  ensureEvmChain,
  getEvmWalletClient,
  type EvmClient,
  type SolanaWalletConnection,
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
const BYTES32_ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

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
    wallets: WalletConnections
  ) => {
    try {
      const numericAmount = parseUnits(amount, DEFAULT_DECIMALS);

      const isSourceSolana = isSolanaChain(sourceChainId);
      const isDestinationSolana = isSolanaChain(destinationChainId);

      const sourceClient = getClients(sourceChainId, wallets);
      const destinationClient = getClients(destinationChainId, wallets);
      const defaultDestination = getDestinationAddress(
        destinationChainId,
        wallets
      );

      // Step 1: Approve
      if (isSourceSolana) {
        await approveSolanaUsdc();
      } else {
        await approveEvmUsdc(
          sourceClient as EvmClient,
          sourceChainId,
          numericAmount,
          wallets
        );
      }

      // Step 2: Burn
      let burnTx: string;
      if (isSourceSolana) {
        burnTx = await burnSolanaUsdc(
          sourceClient as SolanaWalletConnection,
          numericAmount,
          destinationChainId,
          defaultDestination,
          transferType,
          wallets
        );
      } else {
        burnTx = await burnEvmUsdc(
          sourceClient as EvmClient,
          sourceChainId,
          numericAmount,
          destinationChainId,
          defaultDestination,
          transferType,
          wallets
        );
      }

      // Step 3: Retrieve attestation
      const attestation = await retrieveAttestation(burnTx, sourceChainId);

      // Step 4: Mint
      if (isDestinationSolana) {
        await mintSolanaUsdc(destinationClient as SolanaWalletConnection, attestation);
      } else {
        await mintEvmUsdc(destinationClient as EvmClient, destinationChainId, attestation, wallets);
      }
    } catch (error) {
      setCurrentStep("error");
      addLog(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  // ---------------------------------------------------------------------------
  // Step 1: Approve — Grant TokenMessenger permission to spend USDC
  // ---------------------------------------------------------------------------

  const approveEvmUsdc = async (
    client: EvmClient,
    sourceChainId: number,
    amount: bigint,
    wallets: WalletConnections
  ) => {
    setCurrentStep("approving");
    addLog("Approving USDC transfer...");

    try {
      await switchEvmWalletToChain(sourceChainId, wallets);
      if (!client.account) {
        throw new Error("Connect an EVM wallet to continue.");
      }
      const tx = await client.sendTransaction({
        account: client.account,
        chain: client.chain,
        to: CHAIN_CONFIGS[sourceChainId as SupportedChainId].usdcAddress as `0x${string}`,
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
            CHAIN_CONFIGS[sourceChainId as SupportedChainId].tokenMessenger as `0x${string}`,
            amount,
          ],
        }),
      });

      addLog(`USDC Approval Tx: ${tx}`);
      return tx;
    } catch (err) {
      setError("Approval failed");
      throw err;
    }
  };

  // SPL tokens don't require explicit approval like ERC20; the burn handles authorization
  const approveSolanaUsdc = async () => {
    setCurrentStep("approving");
    return "solana-approve-placeholder";
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
    wallets: WalletConnections
  ) => {
    setCurrentStep("burning");
    addLog("Burning USDC...");

    try {
      await switchEvmWalletToChain(sourceChainId, wallets);
      if (!client.account) {
        throw new Error("Connect an EVM wallet to continue.");
      }
      const finalityThreshold = transferType === "fast" ? FAST_FINALITY_THRESHOLD : STANDARD_FINALITY_THRESHOLD;
      const maxFee =
        transferType === "fast"
          ? await getBufferedFastTransferFee(
              sourceChainId as SupportedChainId,
              destinationChainId as SupportedChainId,
              amount
            )
          : 0n;

      let mintRecipient: string;
      if (isSolanaChain(destinationChainId)) {
        const usdcMint = new PublicKey(
          CHAIN_CONFIGS[SupportedChainId.SOLANA_DEVNET].usdcAddress as string
        );
        const destinationWallet = new PublicKey(destinationAddress);
        const tokenAccount = await getAssociatedTokenAddress(
          usdcMint,
          destinationWallet
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
        to: CHAIN_CONFIGS[sourceChainId as SupportedChainId].tokenMessenger as `0x${string}`,
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
                { name: "hookData", type: "bytes32" },
                { name: "maxFee", type: "uint256" },
                { name: "finalityThreshold", type: "uint32" },
              ],
              outputs: [],
            },
          ],
          functionName: "depositForBurn",
          args: [
            amount,
            CHAIN_CONFIGS[destinationChainId as SupportedChainId].destinationDomain,
            mintRecipient as Hex,
            CHAIN_CONFIGS[sourceChainId as SupportedChainId].usdcAddress as `0x${string}`,
            BYTES32_ZERO,
            maxFee,
            finalityThreshold,
          ],
        }),
      });

      addLog(`Burn Tx: ${tx}`);
      return tx;
    } catch (err) {
      setError("Burn failed");
      throw err;
    }
  };

  const burnSolanaUsdc = async (
    wallet: SolanaWalletConnection,
    amount: bigint,
    destinationChainId: number,
    destinationAddress: string,
    transferType: "fast" | "standard",
    wallets: WalletConnections
  ) => {
    setCurrentStep("burning");
    addLog("Burning Solana USDC...");

    try {
      const {
        getAnchorConnection,
        getPrograms,
        getDepositForBurnPdas,
        evmAddressToBytes32,
      } = await import("@/lib/solana-utils");
      const { getAssociatedTokenAddress } = await import("@solana/spl-token");
      const walletPublicKey = wallet.provider.publicKey;
      if (!walletPublicKey) {
        throw new Error("Connect a Solana wallet to continue.");
      }

      const provider = getAnchorConnection(
        {
          publicKey: walletPublicKey,
          signTransaction: wallet.provider.signTransaction.bind(wallet.provider),
          signAllTransactions: wallet.provider.signAllTransactions?.bind(
            wallet.provider
          ),
        },
        SOLANA_RPC_ENDPOINT
      );
      const { messageTransmitterProgram, tokenMessengerMinterProgram } =
        getPrograms(provider);

      const usdcMint = new PublicKey(
        CHAIN_CONFIGS[SupportedChainId.SOLANA_DEVNET].usdcAddress as string
      );

      const pdas = getDepositForBurnPdas(
        { messageTransmitterProgram, tokenMessengerMinterProgram },
        usdcMint,
        CHAIN_CONFIGS[destinationChainId as SupportedChainId].destinationDomain,
        walletPublicKey
      );

      const messageSentEventAccountKeypair = Keypair.generate();

      const userTokenAccount = await getAssociatedTokenAddress(
        usdcMint,
        walletPublicKey
      );

      let mintRecipient: PublicKey;

      if (isSolanaChain(destinationChainId)) {
        mintRecipient = new PublicKey(destinationAddress);
      } else {
        const cleanAddress = destinationAddress
          .replace(/^0x/, "")
          .toLowerCase();
        if (cleanAddress.length !== 40) {
          throw new Error(
            `Invalid EVM address length: ${cleanAddress.length}, expected 40`
          );
        }
        const formattedAddress = `0x${cleanAddress}`;
        const bytes32Address = evmAddressToBytes32(formattedAddress);
        mintRecipient = new PublicKey(hexToBytes(bytes32Address as Hex));
      }

      const evmAddress = `0x${destinationAddress.replace(/^0x/, "")}`;
      const destinationCaller = new PublicKey(
        hexToBytes(evmAddressToBytes32(evmAddress) as Hex)
      );
      const maxFee =
        transferType === "fast"
          ? await getBufferedFastTransferFee(
              SupportedChainId.SOLANA_DEVNET,
              destinationChainId as SupportedChainId,
              amount
            )
          : 0n;

      // Anchor's generated IDL types don't fully align with .methods at runtime (known issue in @coral-xyz/anchor 0.30+)
      const depositForBurnTx = await (
        tokenMessengerMinterProgram as any
      ).methods
        .depositForBurn({
          amount: new BN(amount.toString()),
          destinationDomain: CHAIN_CONFIGS[destinationChainId as SupportedChainId].destinationDomain,
          mintRecipient,
          maxFee: new BN(maxFee.toString()),
          minFinalityThreshold: transferType === "fast" ? FAST_FINALITY_THRESHOLD : STANDARD_FINALITY_THRESHOLD,
          destinationCaller,
        })
        .accounts({
          owner: walletPublicKey,
          eventRentPayer: walletPublicKey,
          senderAuthorityPda: pdas.authorityPda.publicKey,
          burnTokenAccount: userTokenAccount,
          denylistAccount: pdas.denylistAccount.publicKey,
          messageTransmitter: pdas.messageTransmitterAccount.publicKey,
          tokenMessenger: pdas.tokenMessengerAccount.publicKey,
          remoteTokenMessenger: pdas.remoteTokenMessengerKey.publicKey,
          tokenMinter: pdas.tokenMinterAccount.publicKey,
          localToken: pdas.localToken.publicKey,
          burnTokenMint: usdcMint,
          messageSentEventData: messageSentEventAccountKeypair.publicKey,
          messageTransmitterProgram: messageTransmitterProgram.programId,
          tokenMessengerMinterProgram: tokenMessengerMinterProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          eventAuthority: pdas.eventAuthority.publicKey,
          program: tokenMessengerMinterProgram.programId,
        })
        .signers([messageSentEventAccountKeypair])
        .rpc();

      addLog(`Solana burn transaction: ${depositForBurnTx}`);
      return depositForBurnTx;
    } catch (err) {
      setError("Solana burn failed");
      addLog(
        `Solana burn error: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
      throw err;
    }
  };

  // ---------------------------------------------------------------------------
  // Step 3: Attest — Poll Circle's IRIS API until attestation is complete
  // ---------------------------------------------------------------------------

  const retrieveAttestation = async (
    transactionHash: string,
    sourceChainId: number
  ): Promise<AttestationResponse> => {
    setCurrentStep("waiting-attestation");
    addLog("Retrieving attestation...");

    const url = `${IRIS_API_URL}/v2/messages/${CHAIN_CONFIGS[sourceChainId as SupportedChainId].destinationDomain}?transactionHash=${transactionHash}`;

    while (true) {
      try {
        const response = await fetch(url);
        if (response.status === 404) {
          await new Promise((resolve) => setTimeout(resolve, ATTESTATION_POLL_INTERVAL_MS));
          continue;
        }
        if (!response.ok) {
          throw new Error(`Attestation request failed with status ${response.status}`);
        }
        const data = await response.json();
        if (data?.messages?.[0]?.status === "complete") {
          addLog("Attestation retrieved!");
          return data.messages[0] as AttestationResponse;
        }
        addLog("Waiting for attestation...");
        await new Promise((resolve) => setTimeout(resolve, ATTESTATION_POLL_INTERVAL_MS));
      } catch (error) {
        setError("Attestation retrieval failed");
        addLog(
          `Attestation error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        throw error;
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Step 4: Mint — Deliver attestation to destination chain's MessageTransmitter
  // ---------------------------------------------------------------------------

  const mintEvmUsdc = async (
    client: EvmClient,
    destinationChainId: number,
    attestation: AttestationResponse,
    wallets: WalletConnections
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
          chain: CHAIN_CONFIGS[destinationChainId as SupportedChainId].viemChain,
          transport: http(),
        });
        const feeData = await publicClient.estimateFeesPerGas();
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
        addLog(`Gas Used: ${formatUnits(gasWithBuffer, 9)} Gwei`);

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
          maxFeePerGas: feeData.maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        });

        addLog(`Mint Tx: ${tx}`);
        setCurrentStep("completed");
        break;
      } catch (err) {
        if (err instanceof TransactionExecutionError && retries < MINT_MAX_RETRIES) {
          retries++;
          addLog(`Retry ${retries}/${MINT_MAX_RETRIES}...`);
          await new Promise((resolve) => setTimeout(resolve, MINT_RETRY_BASE_DELAY_MS * retries));
          continue;
        }
        throw err;
      }
    }
  };

  const mintSolanaUsdc = async (
    wallet: SolanaWalletConnection,
    attestation: AttestationResponse
  ) => {
    setCurrentStep("minting");
    addLog("Minting Solana USDC...");

    try {
      const {
        getAnchorConnection,
        getPrograms,
        getReceiveMessagePdas,
        decodeNonceFromMessage,
        evmAddressToBytes32,
      } = await import("@/lib/solana-utils");
      const { getAssociatedTokenAddress } = await import("@solana/spl-token");
      const walletPublicKey = wallet.provider.publicKey;
      if (!walletPublicKey) {
        throw new Error("Connect a Solana wallet to continue.");
      }

      const provider = getAnchorConnection(
        {
          publicKey: walletPublicKey,
          signTransaction: wallet.provider.signTransaction.bind(wallet.provider),
          signAllTransactions: wallet.provider.signAllTransactions?.bind(
            wallet.provider
          ),
        },
        SOLANA_RPC_ENDPOINT
      );
      const { messageTransmitterProgram, tokenMessengerMinterProgram } =
        getPrograms(provider);

      const usdcMint = new PublicKey(
        CHAIN_CONFIGS[SupportedChainId.SOLANA_DEVNET].usdcAddress as string
      );
      const messageHex = attestation.message;
      const attestationHex = attestation.attestation;

      const nonce = decodeNonceFromMessage(messageHex);
      const messageBuffer = Buffer.from(messageHex.replace("0x", ""), "hex");
      const sourceDomain = messageBuffer.readUInt32BE(4);

      let remoteTokenAddressHex = "";
      for (const [chainId, config] of Object.entries(CHAIN_CONFIGS)) {
        const id = parseInt(chainId);
        if (config.destinationDomain === sourceDomain && !isSolanaChain(id)) {
          remoteTokenAddressHex = evmAddressToBytes32(config.usdcAddress as string);
          break;
        }
      }

      const pdas = await getReceiveMessagePdas(
        { messageTransmitterProgram, tokenMessengerMinterProgram },
        usdcMint,
        remoteTokenAddressHex,
        sourceDomain.toString(),
        nonce
      );

      const userTokenAccount = await getAssociatedTokenAddress(
        usdcMint,
        walletPublicKey
      );

      const accountMetas = [
        {
          isSigner: false,
          isWritable: false,
          pubkey: pdas.tokenMessengerAccount.publicKey,
        },
        {
          isSigner: false,
          isWritable: false,
          pubkey: pdas.remoteTokenMessengerKey.publicKey,
        },
        {
          isSigner: false,
          isWritable: true,
          pubkey: pdas.tokenMinterAccount.publicKey,
        },
        {
          isSigner: false,
          isWritable: true,
          pubkey: pdas.localToken.publicKey,
        },
        {
          isSigner: false,
          isWritable: false,
          pubkey: pdas.tokenPair.publicKey,
        },
        {
          isSigner: false,
          isWritable: true,
          pubkey: pdas.feeRecipientTokenAccount,
        },
        { isSigner: false, isWritable: true, pubkey: userTokenAccount },
        {
          isSigner: false,
          isWritable: true,
          pubkey: pdas.custodyTokenAccount.publicKey,
        },
        { isSigner: false, isWritable: false, pubkey: TOKEN_PROGRAM_ID },
        {
          isSigner: false,
          isWritable: false,
          pubkey: pdas.tokenMessengerEventAuthority.publicKey,
        },
        {
          isSigner: false,
          isWritable: false,
          pubkey: tokenMessengerMinterProgram.programId,
        },
      ];

      const receiveMessageTx = await (messageTransmitterProgram as any).methods
        .receiveMessage({
          message: Buffer.from(messageHex.replace("0x", ""), "hex"),
          attestation: Buffer.from(attestationHex.replace("0x", ""), "hex"),
        })
        .accounts({
          payer: walletPublicKey,
          caller: walletPublicKey,
          authorityPda: pdas.authorityPda,
          messageTransmitter: pdas.messageTransmitterAccount.publicKey,
          usedNonce: pdas.usedNonce,
          receiver: tokenMessengerMinterProgram.programId,
          systemProgram: SystemProgram.programId,
          eventAuthority: pdas.messageTransmitterEventAuthority.publicKey,
          program: messageTransmitterProgram.programId,
        })
        .remainingAccounts(accountMetas)
        .rpc();

      addLog(`Solana mint transaction: ${receiveMessageTx}`);
      setCurrentStep("completed");
      return receiveMessageTx;
    } catch (err) {
      console.error("Full Solana mint error:", err);
      setError("Solana mint failed");
      addLog(
        `Solana mint error: ${
          err instanceof Error
            ? err.message
            : typeof err === "string"
            ? err
            : JSON.stringify(err)
        }`
      );
      throw err;
    }
  };

  // ---------------------------------------------------------------------------
  // Helpers — Balance checks, client setup, key management
  // ---------------------------------------------------------------------------

  const getBalance = async (
    chainId: SupportedChainId,
    wallets: WalletConnections
  ) => {
    if (isSolanaChain(chainId)) {
      return getSolanaBalance(chainId, wallets);
    }
    return getEvmBalance(chainId, wallets);
  };

  const getSolanaBalance = async (
    chainId: SupportedChainId,
    wallets: WalletConnections
  ) => {
    const solanaWallet = wallets.solana;
    if (!solanaWallet?.provider.publicKey) {
      return "0";
    }

    const connection = getSolanaConnection();
    const usdcMint = new PublicKey(
      CHAIN_CONFIGS[chainId].usdcAddress as string
    );

    try {
      const associatedTokenAddress = await getAssociatedTokenAddress(
        usdcMint,
        solanaWallet.provider.publicKey
      );

      const tokenAccount = await getAccount(connection, associatedTokenAddress);
      const balance =
        Number(tokenAccount.amount) / Math.pow(10, DEFAULT_DECIMALS);
      return balance.toString();
    } catch (error) {
      if (
        error instanceof TokenAccountNotFoundError ||
        error instanceof TokenInvalidAccountOwnerError
      ) {
        return "0";
      }
      throw error;
    }
  };

  const getEvmBalance = async (
    chainId: SupportedChainId,
    wallets: WalletConnections
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
    wallets: WalletConnections
  ) => {
    if (isSolanaChain(chainId)) {
      const wallet = wallets.solana;
      if (!wallet) {
        throw new Error("Connect a Solana wallet to continue.");
      }
      return wallet;
    }
    const wallet = wallets.evm;
    if (!wallet) {
      throw new Error("Connect an EVM wallet to continue.");
    }
    return getEvmWalletClient(wallet, chainId);
  };

  const getSolanaConnection = (): Connection => {
    return new Connection(SOLANA_RPC_ENDPOINT, "confirmed");
  };

  const getBufferedFastTransferFee = async (
    sourceChainId: SupportedChainId,
    destinationChainId: SupportedChainId,
    amount: bigint
  ) => {
    const sourceDomain = CHAIN_CONFIGS[sourceChainId].destinationDomain;
    const destinationDomain = CHAIN_CONFIGS[destinationChainId].destinationDomain;
    const feeUrl = `${IRIS_API_URL}/v2/burn/USDC/fees/${sourceDomain}/${destinationDomain}`;

    const response = await fetch(feeUrl);

    if (!response.ok) {
      throw new Error(`Fee request failed with status ${response.status}`);
    }

    const feePayload = (await response.json()) as FastTransferFeeResponse[];
    const feeEntry = feePayload[0];
    if (!feeEntry) {
      throw new Error("No fee returned for this route");
    }

    const minimumFeeBpsHundredths = parseFeeBps(feeEntry.minimumFee);
    const protocolFee = (amount * minimumFeeBpsHundredths) / 1_000_000n;
    const bufferedFee = (protocolFee * FAST_FEE_BUFFER_PERCENT) / 100n;

    addLog(
      `Fast transfer fee cap: ${formatUnits(bufferedFee, DEFAULT_DECIMALS)} USDC`
    );

    return bufferedFee;
  };

  const parseFeeBps = (minimumFee: number | string) => {
    const minimumFeeString = String(minimumFee);
    const [whole = "0", fraction = ""] = minimumFeeString.split(".");
    const paddedFraction = `${fraction}00`.slice(0, 2);
    return BigInt(`${whole}${paddedFraction}`);
  };

  const isSolanaChain = (chainId: number): boolean => {
    return chainId === SupportedChainId.SOLANA_DEVNET;
  };

  const addLog = (message: string) =>
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);

  const getRequiredEvmWallet = (wallets: WalletConnections) => {
    if (!wallets.evm) {
      throw new Error("Connect an EVM wallet to continue.");
    }
    return wallets.evm;
  };

  const getRequiredSolanaWallet = (wallets: WalletConnections) => {
    if (!wallets.solana?.provider.publicKey) {
      throw new Error("Connect a Solana wallet to continue.");
    }
    return wallets.solana;
  };

  const getDestinationAddress = (
    chainId: number,
    wallets: WalletConnections
  ) => {
    if (isSolanaChain(chainId)) {
      return getRequiredSolanaWallet(wallets).address;
    }
    return getRequiredEvmWallet(wallets).address;
  };

  const switchEvmWalletToChain = async (
    chainId: number,
    wallets: WalletConnections
  ) => {
    const evmWallet = getRequiredEvmWallet(wallets);
    try {
      await ensureEvmChain(
        evmWallet.provider,
        chainId as SupportedChainId
      );
    } catch (error) {
      const walletName = evmWallet.providerInfo?.name ?? "Selected EVM wallet";
      const chainName = CHAIN_CONFIGS[chainId as SupportedChainId].name;
      throw new Error(
        `${walletName} could not switch to ${chainName}. The wallet may not support this chain.`
      );
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
