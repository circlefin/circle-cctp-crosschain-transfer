/**
 * Recover a CCTP mint on Solana Devnet from a prior burn.
 *
 * Put SOLANA_PRIVATE_KEY in `.env` (see `.env.example`).
 *
 * Usage:
 *   npm run recover-mint:solana -- <sourceDomain> <burnTxHash>
 */

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import bs58 from "bs58";

import { CHAIN_CONFIGS, SupportedChainId } from "../src/lib/chains";
import {
  createReceiveMessageInstruction,
  decodeBurnTokenFromMessage,
  decodeNonceFromMessage,
  getAssociatedTokenAddress,
  getReceiveMessagePdas,
  getSolanaConnection,
  hexToBytes,
  sendSolanaTransaction,
} from "../src/lib/solana-utils";
import { parseRecoverArgs, retrieveAttestation } from "./lib/attestation";

const USAGE =
  "Usage: npm run recover-mint:solana -- <sourceDomain> <burnTxHash> (set SOLANA_PRIVATE_KEY in .env)";

async function mintOnSolana(message: string, attestation: string) {
  const secret = process.env.SOLANA_PRIVATE_KEY;
  if (!secret) {
    throw new Error("Set SOLANA_PRIVATE_KEY (base58 secret key)");
  }

  const keypair = await Keypair.fromSecretKey(bs58.decode(secret));
  const connection = getSolanaConnection();
  const usdcMint = new PublicKey(
    CHAIN_CONFIGS[SupportedChainId.SOLANA_DEVNET].usdcAddress as string,
  );
  const messageBytes = hexToBytes(message);
  const sourceDomain = new DataView(
    messageBytes.buffer,
    messageBytes.byteOffset,
    messageBytes.byteLength,
  ).getUint32(4, false);
  const nonce = decodeNonceFromMessage(message);
  const pdas = await getReceiveMessagePdas(
    connection,
    usdcMint,
    decodeBurnTokenFromMessage(message),
    sourceDomain.toString(),
    nonce,
  );
  const userTokenAccount = await getAssociatedTokenAddress(
    usdcMint,
    keypair.publicKey,
  );

  console.log(`Minting on Solana Devnet as ${keypair.publicKey.toBase58()}...`);

  const signature = await sendSolanaTransaction({
    connection,
    wallet: {
      publicKey: keypair.publicKey,
      signTransaction: async (tx: Transaction) => {
        await tx.partialSign(keypair);
        return tx;
      },
    },
    instructions: [
      createReceiveMessageInstruction({
        payer: keypair.publicKey,
        message: messageBytes,
        attestation: hexToBytes(attestation),
        pdas,
        userTokenAccount,
      }),
    ],
  });

  console.log(`Mint confirmed: ${signature}`);
}

async function main() {
  const { sourceDomain, burnTransactionHash } = parseRecoverArgs(USAGE);
  const { message, attestation } = await retrieveAttestation(
    sourceDomain,
    burnTransactionHash,
  );
  await mintOnSolana(message, attestation);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
