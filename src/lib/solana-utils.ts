import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
  SystemProgram,
} from "@solana/web3.js";
import { hexlify } from "ethers";
import bs58 from "bs58";
import * as spl from "@solana/spl-token";
import {
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import {
  SupportedChainId,
  CHAIN_IDS_TO_USDC_ADDRESSES,
  CHAIN_IDS_TO_MESSAGE_TRANSMITTER,
  CHAIN_IDS_TO_TOKEN_MESSENGER,
  DESTINATION_DOMAINS,
  SOLANA_RPC_ENDPOINT,
  IRIS_API_URL,
} from "./chains";

// Import IDLs from JSON files
import MessageTransmitterIdl from "../solana/idl/message_transmitter.json";
import TokenMessengerMinterIdl from "../solana/idl/token_messenger_minter.json";
import type { TokenMessengerMinterV2 } from "../solana/types/token_messenger_minter";
import type { MessageTransmitterV2 } from "../solana/types/message_transmitter";

// Use constants from chains.ts
export const SOLANA_SRC_DOMAIN_ID =
  DESTINATION_DOMAINS[SupportedChainId.SOLANA_DEVNET];
export const SOLANA_USDC_ADDRESS = CHAIN_IDS_TO_USDC_ADDRESSES[
  SupportedChainId.SOLANA_DEVNET
] as string;

export interface FindProgramAddressResponse {
  publicKey: anchor.web3.PublicKey;
  bump: number;
}

// Create a wallet from a Keypair for Anchor provider
export class NodeWallet implements anchor.Wallet {
  constructor(readonly payer: Keypair) {}

  async signTransaction<T extends Transaction | VersionedTransaction>(
    tx: T,
  ): Promise<T> {
    if (isVersionedTransaction(tx)) {
      tx.sign([this.payer]);
    } else {
      tx.partialSign(this.payer);
    }

    return tx;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    txs: T[],
  ): Promise<T[]> {
    return txs.map((t) => {
      if (isVersionedTransaction(t)) {
        t.sign([this.payer]);
      } else {
        t.partialSign(this.payer);
      }
      return t;
    });
  }

  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }
}

export const isVersionedTransaction = (
  tx: Transaction | VersionedTransaction,
): tx is VersionedTransaction => {
  return "version" in tx;
};

// Configure client to use the provider and return it
export const getAnchorConnection = (
  keypair: Keypair,
  rpcUrl: string = SOLANA_RPC_ENDPOINT,
) => {
  const connection = new anchor.web3.Connection(rpcUrl, "confirmed");
  const wallet = new NodeWallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);
  return provider;
};

export const getPrograms = (provider: anchor.AnchorProvider) => {
  // Anchor will automatically use the program ID from the IDL metadata
  const messageTransmitterProgram = new anchor.Program<MessageTransmitterV2>(
    MessageTransmitterIdl as MessageTransmitterV2,
    provider,
  );

  const tokenMessengerMinterProgram =
    new anchor.Program<TokenMessengerMinterV2>(
      TokenMessengerMinterIdl as TokenMessengerMinterV2,
      provider,
    );

  return { messageTransmitterProgram, tokenMessengerMinterProgram };
};

export const getDepositForBurnPdas = (
  {
    messageTransmitterProgram,
    tokenMessengerMinterProgram,
  }: ReturnType<typeof getPrograms>,
  usdcAddress: PublicKey,
  destinationDomain: number,
) => {
  const messageTransmitterAccount = findProgramAddress(
    "message_transmitter",
    messageTransmitterProgram.programId,
  );
  const tokenMessengerAccount = findProgramAddress(
    "token_messenger",
    tokenMessengerMinterProgram.programId,
  );
  const tokenMinterAccount = findProgramAddress(
    "token_minter",
    tokenMessengerMinterProgram.programId,
  );
  const localToken = findProgramAddress(
    "local_token",
    tokenMessengerMinterProgram.programId,
    [usdcAddress],
  );
  const remoteTokenMessengerKey = findProgramAddress(
    "remote_token_messenger",
    tokenMessengerMinterProgram.programId,
    [destinationDomain.toString()],
  );
  const authorityPda = findProgramAddress(
    "sender_authority",
    tokenMessengerMinterProgram.programId,
  );

  return {
    messageTransmitterAccount,
    tokenMessengerAccount,
    tokenMinterAccount,
    localToken,
    remoteTokenMessengerKey,
    authorityPda,
  };
};

export const getReceiveMessagePdas = async (
  {
    messageTransmitterProgram,
    tokenMessengerMinterProgram,
  }: ReturnType<typeof getPrograms>,
  solUsdcAddress: PublicKey,
  remoteUsdcAddressHex: string,
  remoteDomain: string,
  nonce: Buffer,
) => {
  const tokenMessengerAccount = findProgramAddress(
    "token_messenger",
    tokenMessengerMinterProgram.programId,
  );
  const messageTransmitterAccount = findProgramAddress(
    "message_transmitter",
    messageTransmitterProgram.programId,
  );
  const tokenMinterAccount = findProgramAddress(
    "token_minter",
    tokenMessengerMinterProgram.programId,
  );
  const localToken = findProgramAddress(
    "local_token",
    tokenMessengerMinterProgram.programId,
    [solUsdcAddress],
  );
  const remoteTokenMessengerKey = findProgramAddress(
    "remote_token_messenger",
    tokenMessengerMinterProgram.programId,
    [remoteDomain],
  );
  const remoteTokenKey = new PublicKey(hexToBytes(remoteUsdcAddressHex));
  const tokenPair = findProgramAddress(
    "token_pair",
    tokenMessengerMinterProgram.programId,
    [remoteDomain, remoteTokenKey],
  );
  const custodyTokenAccount = findProgramAddress(
    "custody",
    tokenMessengerMinterProgram.programId,
    [solUsdcAddress],
  );
  const authorityPda = findProgramAddress(
    "message_transmitter_authority",
    messageTransmitterProgram.programId,
    [tokenMessengerMinterProgram.programId],
  ).publicKey;
  const tokenMessengerEventAuthority = findProgramAddress(
    "__event_authority",
    tokenMessengerMinterProgram.programId,
  );
  const usedNonce = findProgramAddress(
    "used_nonce",
    messageTransmitterProgram.programId,
    [nonce],
  ).publicKey;

  const tokenMessengerAccounts = await (
    tokenMessengerMinterProgram.account as any
  ).tokenMessenger.fetch(tokenMessengerAccount.publicKey);
  const feeRecipientTokenAccount = await getAssociatedTokenAddress(
    solUsdcAddress,
    tokenMessengerAccounts.feeRecipient,
  );

  return {
    messageTransmitterAccount,
    tokenMessengerAccount,
    tokenMinterAccount,
    localToken,
    remoteTokenMessengerKey,
    remoteTokenKey,
    tokenPair,
    custodyTokenAccount,
    authorityPda,
    tokenMessengerEventAuthority,
    usedNonce,
    feeRecipientTokenAccount,
  };
};

export const solanaAddressToHex = (solanaAddress: string): string =>
  hexlify(bs58.decode(solanaAddress));

export const evmAddressToSolana = (evmAddress: string): string =>
  bs58.encode(hexToBytes(evmAddress));

export const evmAddressToBytes32 = (address: string): string =>
  `0x000000000000000000000000${address.replace("0x", "")}`;

export const hexToBytes = (hex: string): Buffer =>
  Buffer.from(hex.replace("0x", ""), "hex");

// Convenience wrapper for PublicKey.findProgramAddressSync
export const findProgramAddress = (
  label: string,
  programId: PublicKey,
  extraSeeds: (string | number[] | Buffer | PublicKey)[] | null = null,
): FindProgramAddressResponse => {
  const seeds = [Buffer.from(anchor.utils.bytes.utf8.encode(label))];
  if (extraSeeds) {
    for (const extraSeed of extraSeeds) {
      if (typeof extraSeed === "string") {
        seeds.push(Buffer.from(anchor.utils.bytes.utf8.encode(extraSeed)));
      } else if (Array.isArray(extraSeed)) {
        seeds.push(Buffer.from(extraSeed as number[]));
      } else if (Buffer.isBuffer(extraSeed)) {
        seeds.push(Buffer.from(extraSeed));
      } else {
        seeds.push(Buffer.from(extraSeed.toBuffer()));
      }
    }
  }
  const res = PublicKey.findProgramAddressSync(seeds, programId);
  return { publicKey: res[0], bump: res[1] };
};

// Fetches attestation from attestation service given the txHash
export const getMessages = async (txHash: string) => {
  console.log("Fetching messages for tx...", txHash);
  let attestationResponse: any = {};
  while (
    attestationResponse.error ||
    !attestationResponse.messages ||
    attestationResponse.messages?.[0]?.attestation === "PENDING"
  ) {
    // Use Circle's official endpoint format (no /v2/)
    const response = await fetch(
      `${IRIS_API_URL}/messages/${SOLANA_SRC_DOMAIN_ID}/${txHash}`,
    );
    attestationResponse = await response.json();
    // Wait 2 seconds to avoid getting rate limited
    if (
      attestationResponse.error ||
      !attestationResponse.messages ||
      attestationResponse.messages?.[0]?.attestation === "PENDING"
    ) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return attestationResponse;
};

// For CCTP v2: Nonce is at offset 8, 8 bytes, little-endian
export const decodeNonceFromMessage = (messageHex: string): Buffer => {
  const nonceIndex = 12;
  const nonceBytesLength = 32;
  const message = hexToBytes(messageHex);
  const eventNonceBytes = message.subarray(
    nonceIndex,
    nonceIndex + nonceBytesLength,
  );
  return eventNonceBytes;
};
