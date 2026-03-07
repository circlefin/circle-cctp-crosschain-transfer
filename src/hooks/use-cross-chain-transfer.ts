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
  createWalletClient,
  http,
  encodeFunctionData,
  HttpTransport,
  type Chain,
  type Account,
  type WalletClient,
  type Hex,
  TransactionExecutionError,
  parseUnits,
  createPublicClient,
  formatUnits,
  parseEther,
  toHex,
  hexToBytes,
} from "viem";
import { privateKeyToAccount, nonceManager } from "viem/accounts";

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
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

export type TransferStep =
  | "idle"
  | "approving"
  | "burning"
  | "waiting-attestation"
  | "minting"
  | "completed"
  | "error";

type EvmClient = WalletClient<HttpTransport, Chain, Account>;

interface AttestationResponse {
  message: Hex;
  attestation: Hex;
  status: string;
}

const DEFAULT_DECIMALS = 6;
const USDC_APPROVAL_AMOUNT = 10_000_000_000n; // 10,000 USDC
const FAST_FINALITY_THRESHOLD = 1000;
const STANDARD_FINALITY_THRESHOLD = 2000;
const ATTESTATION_POLL_INTERVAL_MS = 5000;
const MINT_MAX_RETRIES = 3;
const MINT_RETRY_BASE_DELAY_MS = 2000;
const GAS_BUFFER_PERCENT = 120n;
const MIN_NATIVE_BALANCE_ETH = "0.01";
const MIN_NATIVE_BALANCE_SOL = 0.01;
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
    transferType: "fast" | "standard"
  ) => {
    try {
      const numericAmount = parseUnits(amount, DEFAULT_DECIMALS);

      const isSourceSolana = isSolanaChain(sourceChainId);
      const isDestinationSolana = isSolanaChain(destinationChainId);

      let defaultDestination: string;

      const sourceClient = getClients(sourceChainId);
      const destinationClient = getClients(destinationChainId);

      if (isDestinationSolana) {
        const destinationPrivateKey = getPrivateKeyForChain(destinationChainId);
        const destinationKeypair = getSolanaKeypair(destinationPrivateKey);
        defaultDestination = destinationKeypair.publicKey.toString();
      } else {
        const destinationPrivateKey = getPrivateKeyForChain(destinationChainId);
        const account = privateKeyToAccount(
          `0x${destinationPrivateKey.replace(/^0x/, "")}`
        );
        defaultDestination = account.address;
      }

      // Step 1: Approve
      if (isSourceSolana) {
        await approveSolanaUsdc(sourceClient as Keypair);
      } else {
        await approveEvmUsdc(sourceClient as EvmClient, sourceChainId);
      }

      // Step 2: Burn
      let burnTx: string;
      if (isSourceSolana) {
        burnTx = await burnSolanaUsdc(
          sourceClient as Keypair,
          numericAmount,
          destinationChainId,
          defaultDestination,
          transferType
        );
      } else {
        burnTx = await burnEvmUsdc(
          sourceClient as EvmClient,
          sourceChainId,
          numericAmount,
          destinationChainId,
          defaultDestination,
          transferType
        );
      }

      // Step 3: Retrieve attestation
      const attestation = await retrieveAttestation(burnTx, sourceChainId);

      // Verify destination has enough native token for gas
      const minBalance = isSolanaChain(destinationChainId)
        ? BigInt(MIN_NATIVE_BALANCE_SOL * LAMPORTS_PER_SOL)
        : parseEther(MIN_NATIVE_BALANCE_ETH);

      const balance = await checkNativeBalance(destinationChainId);
      if (balance < minBalance) {
        throw new Error("Insufficient native token for gas fees");
      }

      // Step 4: Mint
      if (isDestinationSolana) {
        await mintSolanaUsdc(destinationClient as Keypair, attestation);
      } else {
        await mintEvmUsdc(destinationClient as EvmClient, destinationChainId, attestation);
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
    client: WalletClient<HttpTransport, Chain, Account>,
    sourceChainId: number
  ) => {
    setCurrentStep("approving");
    addLog("Approving USDC transfer...");

    try {
      const tx = await client.sendTransaction({
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
            USDC_APPROVAL_AMOUNT,
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
  const approveSolanaUsdc = async (keypair: Keypair) => {
    setCurrentStep("approving");
    return "solana-approve-placeholder";
  };

  // ---------------------------------------------------------------------------
  // Step 2: Burn — Burn USDC on source chain via TokenMessenger.depositForBurn
  // ---------------------------------------------------------------------------

  const burnEvmUsdc = async (
    client: WalletClient<HttpTransport, Chain, Account>,
    sourceChainId: number,
    amount: bigint,
    destinationChainId: number,
    destinationAddress: string,
    transferType: "fast" | "standard"
  ) => {
    setCurrentStep("burning");
    addLog("Burning USDC...");

    try {
      const finalityThreshold = transferType === "fast" ? FAST_FINALITY_THRESHOLD : STANDARD_FINALITY_THRESHOLD;
      const maxFee = amount - 1n;

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
    keypair: Keypair,
    amount: bigint,
    destinationChainId: number,
    destinationAddress: string,
    transferType: "fast" | "standard"
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

      const provider = getAnchorConnection(keypair, SOLANA_RPC_ENDPOINT);
      const { messageTransmitterProgram, tokenMessengerMinterProgram } =
        getPrograms(provider);

      const usdcMint = new PublicKey(
        CHAIN_CONFIGS[SupportedChainId.SOLANA_DEVNET].usdcAddress as string
      );

      const pdas = getDepositForBurnPdas(
        { messageTransmitterProgram, tokenMessengerMinterProgram },
        usdcMint,
        CHAIN_CONFIGS[destinationChainId as SupportedChainId].destinationDomain,
        keypair.publicKey
      );

      const messageSentEventAccountKeypair = Keypair.generate();

      const userTokenAccount = await getAssociatedTokenAddress(
        usdcMint,
        keypair.publicKey
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

      const evmPrivateKey = getPrivateKeyForChain(destinationChainId);
      const evmAccount = privateKeyToAccount(
        `0x${evmPrivateKey.replace(/^0x/, "")}`
      );
      const evmAddress = evmAccount.address;
      const destinationCaller = new PublicKey(
        hexToBytes(evmAddressToBytes32(evmAddress) as Hex)
      );

      // Anchor's generated IDL types don't fully align with .methods at runtime (known issue in @coral-xyz/anchor 0.30+)
      const depositForBurnTx = await (
        tokenMessengerMinterProgram as any
      ).methods
        .depositForBurn({
          amount: new BN(amount.toString()),
          destinationDomain: CHAIN_CONFIGS[destinationChainId as SupportedChainId].destinationDomain,
          mintRecipient,
          maxFee: new BN((amount - 1n).toString()),
          minFinalityThreshold: transferType === "fast" ? FAST_FINALITY_THRESHOLD : STANDARD_FINALITY_THRESHOLD,
          destinationCaller,
        })
        .accounts({
          owner: keypair.publicKey,
          eventRentPayer: keypair.publicKey,
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
    client: WalletClient<HttpTransport, Chain, Account>,
    destinationChainId: number,
    attestation: AttestationResponse
  ) => {
    let retries = 0;
    setCurrentStep("minting");
    addLog("Minting USDC...");

    while (retries < MINT_MAX_RETRIES) {
      try {
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

  const mintSolanaUsdc = async (keypair: Keypair, attestation: AttestationResponse) => {
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

      const provider = getAnchorConnection(keypair, SOLANA_RPC_ENDPOINT);
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
        keypair.publicKey
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
          payer: keypair.publicKey,
          caller: keypair.publicKey,
          authorityPda: pdas.authorityPda,
          messageTransmitter: pdas.messageTransmitterAccount.publicKey,
          usedNonce: pdas.usedNonce,
          receiver: tokenMessengerMinterProgram.programId,
          systemProgram: SystemProgram.programId,
          eventAuthority: pdas.messageTransmitterEventAuthority.publicKey,
          program: messageTransmitterProgram.programId,
        })
        .remainingAccounts(accountMetas)
        .signers([keypair])
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

  const getBalance = async (chainId: SupportedChainId) => {
    if (isSolanaChain(chainId)) {
      return getSolanaBalance(chainId);
    }
    return getEvmBalance(chainId);
  };

  const getSolanaBalance = async (chainId: SupportedChainId) => {
    const connection = getSolanaConnection();
    const privateKey = getPrivateKeyForChain(chainId);
    const keypair = getSolanaKeypair(privateKey);
    const usdcMint = new PublicKey(
      CHAIN_CONFIGS[chainId].usdcAddress as string
    );

    try {
      const associatedTokenAddress = await getAssociatedTokenAddress(
        usdcMint,
        keypair.publicKey
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

  const getEvmBalance = async (chainId: SupportedChainId) => {
    const publicClient = createPublicClient({
      chain: CHAIN_CONFIGS[chainId as SupportedChainId].viemChain,
      transport: http(),
    });
    const privateKey = getPrivateKeyForChain(chainId);
    const account = privateKeyToAccount(`0x${privateKey.replace(/^0x/, "")}`, {
      nonceManager,
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
      args: [account.address],
    });

    const formattedBalance = formatUnits(balance, DEFAULT_DECIMALS);
    return formattedBalance;
  };

  const checkNativeBalance = async (chainId: SupportedChainId) => {
    if (isSolanaChain(chainId)) {
      const connection = getSolanaConnection();
      const privateKey = getPrivateKeyForChain(chainId);
      const keypair = getSolanaKeypair(privateKey);
      const balance = await connection.getBalance(keypair.publicKey);
      return BigInt(balance);
    } else {
      const publicClient = createPublicClient({
        chain: CHAIN_CONFIGS[chainId as SupportedChainId].viemChain,
        transport: http(),
      });
      const privateKey = getPrivateKeyForChain(chainId);
      const account = privateKeyToAccount(
        `0x${privateKey.replace(/^0x/, "")}`
      );
      const balance = await publicClient.getBalance({
        address: account.address,
      });
      return balance;
    }
  };

  const getClients = (chainId: SupportedChainId) => {
    const privateKey = getPrivateKeyForChain(chainId);

    if (isSolanaChain(chainId)) {
      return getSolanaKeypair(privateKey);
    }
    const account = privateKeyToAccount(`0x${privateKey.replace(/^0x/, "")}`, {
      nonceManager,
    });
    return createWalletClient({
      chain: CHAIN_CONFIGS[chainId as SupportedChainId].viemChain,
      transport: http(),
      account,
    });
  };

  const getPrivateKeyForChain = (chainId: number): string => {
    if (isSolanaChain(chainId)) {
      const solanaKey = process.env.NEXT_PUBLIC_SOLANA_PRIVATE_KEY;
      if (!solanaKey) {
        throw new Error(
          "Solana private key not found. Please set NEXT_PUBLIC_SOLANA_PRIVATE_KEY in your environment."
        );
      }
      return solanaKey;
    } else {
      const evmKey = process.env.NEXT_PUBLIC_EVM_PRIVATE_KEY;
      if (!evmKey) {
        throw new Error(
          "EVM private key not found. Please set NEXT_PUBLIC_EVM_PRIVATE_KEY in your environment."
        );
      }
      return evmKey;
    }
  };

  const getSolanaKeypair = (privateKey: string): Keypair => {
    try {
      const privateKeyBytes = bs58.decode(privateKey);
      if (privateKeyBytes.length === 64) {
        return Keypair.fromSecretKey(privateKeyBytes);
      } else if (privateKeyBytes.length === 32) {
        return Keypair.fromSeed(privateKeyBytes);
      }
    } catch (error) {
      const cleanPrivateKey = privateKey.replace(/^0x/, "");
      if (cleanPrivateKey.length === 64) {
        const privateKeyBytes = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          privateKeyBytes[i] = parseInt(cleanPrivateKey.substring(i * 2, i * 2 + 2), 16);
        }
        return Keypair.fromSeed(privateKeyBytes);
      }
    }

    throw new Error(
      "Invalid Solana private key format. Expected base58 encoded key or 32-byte hex string."
    );
  };

  const getSolanaConnection = (): Connection => {
    return new Connection(SOLANA_RPC_ENDPOINT, "confirmed");
  };

  const isSolanaChain = (chainId: number): boolean => {
    return chainId === SupportedChainId.SOLANA_DEVNET;
  };

  const addLog = (message: string) =>
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);

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
