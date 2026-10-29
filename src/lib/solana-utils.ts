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

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import { SOLANA_RPC_ENDPOINT } from "./chains";

export const MESSAGE_TRANSMITTER_PROGRAM_ID = new PublicKey(
  "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC",
);
export const TOKEN_MESSENGER_MINTER_PROGRAM_ID = new PublicKey(
  "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe",
);
export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

// Anchor instruction discriminators from the on-chain IDLs
const DEPOSIT_FOR_BURN_DISCRIMINATOR = Uint8Array.from([
  215, 60, 61, 46, 114, 55, 128, 176,
]);
const RECEIVE_MESSAGE_DISCRIMINATOR = Uint8Array.from([
  38, 144, 127, 225, 31, 225, 238, 25,
]);

// TokenMessenger account: 8-byte Anchor disc + fields; fee_recipient starts here
const TOKEN_MESSENGER_FEE_RECIPIENT_OFFSET = 8 + 32 + 32 + 32 + 4 + 1;
// SPL Token account: mint (32) + owner (32) + amount (u64 LE)
const TOKEN_ACCOUNT_AMOUNT_OFFSET = 64;

export type SolanaWalletSigner = {
  publicKey: PublicKey;
  signTransaction(tx: Transaction): Promise<Transaction>;
};

export function getSolanaConnection(
  rpcUrl: string = SOLANA_RPC_ENDPOINT,
): Connection {
  return new Connection(rpcUrl, "confirmed");
}

async function findProgramAddress(
  label: string,
  programId: PublicKey,
  extraSeeds: (string | Uint8Array | PublicKey)[] = [],
): Promise<PublicKey> {
  const seeds: Uint8Array[] = [new TextEncoder().encode(label)];
  for (const seed of extraSeeds) {
    if (typeof seed === "string") {
      seeds.push(new TextEncoder().encode(seed));
    } else if (seed instanceof PublicKey) {
      seeds.push(seed.toBytes());
    } else {
      seeds.push(seed);
    }
  }
  const [pda] = await PublicKey.findProgramAddress(seeds, programId);
  return pda;
}

export async function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey,
): Promise<PublicKey> {
  const [ata] = await PublicKey.findProgramAddress(
    [owner.toBytes(), TOKEN_PROGRAM_ID.toBytes(), mint.toBytes()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

export async function getTokenAccountAmount(
  connection: Connection,
  tokenAccount: PublicKey,
): Promise<bigint | null> {
  const info = await connection.getAccountInfo(tokenAccount);
  if (!info) {
    return null;
  }
  const view = new DataView(
    info.data.buffer,
    info.data.byteOffset,
    info.data.byteLength,
  );
  return view.getBigUint64(TOKEN_ACCOUNT_AMOUNT_OFFSET, true);
}

export async function getDepositForBurnPdas(
  usdcMint: PublicKey,
  destinationDomain: number,
  owner: PublicKey,
) {
  const [
    messageTransmitter,
    tokenMessenger,
    tokenMinter,
    localToken,
    remoteTokenMessenger,
    senderAuthority,
    denylistAccount,
    eventAuthority,
  ] = await Promise.all([
    findProgramAddress("message_transmitter", MESSAGE_TRANSMITTER_PROGRAM_ID),
    findProgramAddress("token_messenger", TOKEN_MESSENGER_MINTER_PROGRAM_ID),
    findProgramAddress("token_minter", TOKEN_MESSENGER_MINTER_PROGRAM_ID),
    findProgramAddress("local_token", TOKEN_MESSENGER_MINTER_PROGRAM_ID, [
      usdcMint,
    ]),
    findProgramAddress(
      "remote_token_messenger",
      TOKEN_MESSENGER_MINTER_PROGRAM_ID,
      [destinationDomain.toString()],
    ),
    findProgramAddress("sender_authority", TOKEN_MESSENGER_MINTER_PROGRAM_ID),
    findProgramAddress("denylist_account", TOKEN_MESSENGER_MINTER_PROGRAM_ID, [
      owner,
    ]),
    findProgramAddress("__event_authority", TOKEN_MESSENGER_MINTER_PROGRAM_ID),
  ]);

  return {
    messageTransmitter,
    tokenMessenger,
    tokenMinter,
    localToken,
    remoteTokenMessenger,
    senderAuthority,
    denylistAccount,
    eventAuthority,
  };
}

export async function getReceiveMessagePdas(
  connection: Connection,
  solUsdcMint: PublicKey,
  remoteUsdcAddressHex: string,
  remoteDomain: string,
  nonce: Uint8Array,
) {
  const remoteToken = new PublicKey(hexToBytes(remoteUsdcAddressHex));

  const [
    tokenMessenger,
    messageTransmitter,
    tokenMinter,
    localToken,
    remoteTokenMessenger,
    tokenPair,
    custodyTokenAccount,
    authorityPda,
    tokenMessengerEventAuthority,
    messageTransmitterEventAuthority,
    usedNonce,
  ] = await Promise.all([
    findProgramAddress("token_messenger", TOKEN_MESSENGER_MINTER_PROGRAM_ID),
    findProgramAddress("message_transmitter", MESSAGE_TRANSMITTER_PROGRAM_ID),
    findProgramAddress("token_minter", TOKEN_MESSENGER_MINTER_PROGRAM_ID),
    findProgramAddress("local_token", TOKEN_MESSENGER_MINTER_PROGRAM_ID, [
      solUsdcMint,
    ]),
    findProgramAddress(
      "remote_token_messenger",
      TOKEN_MESSENGER_MINTER_PROGRAM_ID,
      [remoteDomain],
    ),
    findProgramAddress("token_pair", TOKEN_MESSENGER_MINTER_PROGRAM_ID, [
      remoteDomain,
      remoteToken,
    ]),
    findProgramAddress("custody", TOKEN_MESSENGER_MINTER_PROGRAM_ID, [
      solUsdcMint,
    ]),
    findProgramAddress(
      "message_transmitter_authority",
      MESSAGE_TRANSMITTER_PROGRAM_ID,
      [TOKEN_MESSENGER_MINTER_PROGRAM_ID],
    ),
    findProgramAddress("__event_authority", TOKEN_MESSENGER_MINTER_PROGRAM_ID),
    findProgramAddress("__event_authority", MESSAGE_TRANSMITTER_PROGRAM_ID),
    findProgramAddress("used_nonce", MESSAGE_TRANSMITTER_PROGRAM_ID, [nonce]),
  ]);

  const feeRecipient = await readTokenMessengerFeeRecipient(
    connection,
    tokenMessenger,
  );
  const feeRecipientTokenAccount = await getAssociatedTokenAddress(
    solUsdcMint,
    feeRecipient,
  );

  return {
    tokenMessenger,
    messageTransmitter,
    tokenMinter,
    localToken,
    remoteTokenMessenger,
    remoteToken,
    tokenPair,
    custodyTokenAccount,
    authorityPda,
    tokenMessengerEventAuthority,
    messageTransmitterEventAuthority,
    usedNonce,
    feeRecipientTokenAccount,
  };
}

export function createDepositForBurnInstruction(params: {
  amount: bigint;
  destinationDomain: number;
  mintRecipient: PublicKey;
  destinationCaller: PublicKey;
  maxFee: bigint;
  minFinalityThreshold: number;
  owner: PublicKey;
  userTokenAccount: PublicKey;
  usdcMint: PublicKey;
  messageSentEventAccount: PublicKey;
  pdas: Awaited<ReturnType<typeof getDepositForBurnPdas>>;
}): TransactionInstruction {
  const data = concatBytes(
    DEPOSIT_FOR_BURN_DISCRIMINATOR,
    encodeU64(params.amount),
    encodeU32(params.destinationDomain),
    params.mintRecipient.toBytes(),
    params.destinationCaller.toBytes(),
    encodeU64(params.maxFee),
    encodeU32(params.minFinalityThreshold),
  );

  return new TransactionInstruction({
    programId: TOKEN_MESSENGER_MINTER_PROGRAM_ID,
    keys: [
      { pubkey: params.owner, isSigner: true, isWritable: false },
      { pubkey: params.owner, isSigner: true, isWritable: true },
      { pubkey: params.pdas.senderAuthority, isSigner: false, isWritable: false },
      { pubkey: params.userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: params.pdas.denylistAccount, isSigner: false, isWritable: false },
      {
        pubkey: params.pdas.messageTransmitter,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: params.pdas.tokenMessenger, isSigner: false, isWritable: false },
      {
        pubkey: params.pdas.remoteTokenMessenger,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: params.pdas.tokenMinter, isSigner: false, isWritable: false },
      { pubkey: params.pdas.localToken, isSigner: false, isWritable: true },
      { pubkey: params.usdcMint, isSigner: false, isWritable: true },
      {
        pubkey: params.messageSentEventAccount,
        isSigner: true,
        isWritable: true,
      },
      {
        pubkey: MESSAGE_TRANSMITTER_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: TOKEN_MESSENGER_MINTER_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: params.pdas.eventAuthority, isSigner: false, isWritable: false },
      {
        pubkey: TOKEN_MESSENGER_MINTER_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
    ],
    data,
  });
}

export function createReceiveMessageInstruction(params: {
  payer: PublicKey;
  message: Uint8Array;
  attestation: Uint8Array;
  pdas: Awaited<ReturnType<typeof getReceiveMessagePdas>>;
  userTokenAccount: PublicKey;
}): TransactionInstruction {
  const data = concatBytes(
    RECEIVE_MESSAGE_DISCRIMINATOR,
    encodeBytes(params.message),
    encodeBytes(params.attestation),
  );

  const remainingAccounts = [
    { pubkey: params.pdas.tokenMessenger, isSigner: false, isWritable: false },
    {
      pubkey: params.pdas.remoteTokenMessenger,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: params.pdas.tokenMinter, isSigner: false, isWritable: true },
    { pubkey: params.pdas.localToken, isSigner: false, isWritable: true },
    { pubkey: params.pdas.tokenPair, isSigner: false, isWritable: false },
    {
      pubkey: params.pdas.feeRecipientTokenAccount,
      isSigner: false,
      isWritable: true,
    },
    { pubkey: params.userTokenAccount, isSigner: false, isWritable: true },
    {
      pubkey: params.pdas.custodyTokenAccount,
      isSigner: false,
      isWritable: true,
    },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: params.pdas.tokenMessengerEventAuthority,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: TOKEN_MESSENGER_MINTER_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
  ];

  return new TransactionInstruction({
    programId: MESSAGE_TRANSMITTER_PROGRAM_ID,
    keys: [
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: params.payer, isSigner: true, isWritable: false },
      { pubkey: params.pdas.authorityPda, isSigner: false, isWritable: false },
      {
        pubkey: params.pdas.messageTransmitter,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: params.pdas.usedNonce, isSigner: false, isWritable: true },
      {
        pubkey: TOKEN_MESSENGER_MINTER_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      {
        pubkey: params.pdas.messageTransmitterEventAuthority,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: MESSAGE_TRANSMITTER_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      ...remainingAccounts,
    ],
    data,
  });
}

export async function sendSolanaTransaction(params: {
  connection: Connection;
  wallet: SolanaWalletSigner;
  instructions: TransactionInstruction[];
  signers?: Keypair[];
}): Promise<string> {
  const { blockhash, lastValidBlockHeight } =
    await params.connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    feePayer: params.wallet.publicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(...params.instructions);

  if (params.signers?.length) {
    await tx.partialSign(...params.signers);
  }

  const signed = await params.wallet.signTransaction(tx);
  const signature = await params.connection.sendRawTransaction(
    await signed.serialize(),
  );
  await params.connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  return signature;
}

export const evmAddressToBytes32 = (address: string): string =>
  `0x000000000000000000000000${address.replace("0x", "")}`;

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.replace(/^0x/, "");
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// CCTP V2 message header: nonce is at byte offset 12, 32 bytes (message[12..44])
export function decodeNonceFromMessage(messageHex: string): Uint8Array {
  return hexToBytes(messageHex).subarray(12, 44);
}

async function readTokenMessengerFeeRecipient(
  connection: Connection,
  tokenMessenger: PublicKey,
): Promise<PublicKey> {
  const info = await connection.getAccountInfo(tokenMessenger);
  if (!info) {
    throw new Error("TokenMessenger account not found");
  }
  return new PublicKey(
    info.data.subarray(
      TOKEN_MESSENGER_FEE_RECIPIENT_OFFSET,
      TOKEN_MESSENGER_FEE_RECIPIENT_OFFSET + 32,
    ),
  );
}

function encodeU32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, true);
  return out;
}

function encodeU64(value: bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, value, true);
  return out;
}

function encodeBytes(value: Uint8Array): Uint8Array {
  return concatBytes(encodeU32(value.length), value);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
