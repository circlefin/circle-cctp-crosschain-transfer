/**
 * Recover a CCTP mint on Sui Testnet from a prior burn.
 *
 * Put SUI_PRIVATE_KEY in `.env` (see `.env.example`).
 *
 * Usage:
 *   npm run recover-mint:sui -- <sourceDomain> <burnTxHash>
 */

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

import {
  buildReceiveMessageTransaction,
  getSuiClient,
} from "../src/lib/sui-utils";
import { parseRecoverArgs, retrieveAttestation } from "./lib/attestation";

const USAGE =
  "Usage: npm run recover-mint:sui -- <sourceDomain> <burnTxHash> (set SUI_PRIVATE_KEY in .env)";

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Uint8Array.from(Buffer.from(normalized, "hex"));
}

async function mintOnSui(message: string, attestation: string) {
  const secret =
    process.env.SUI_PRIVATE_KEY ?? process.env.SUI_SIGNER_KEY;
  if (!secret) {
    throw new Error("Set SUI_PRIVATE_KEY");
  }

  const suiClient = getSuiClient();
  const suiSigner = Ed25519Keypair.fromSecretKey(
    decodeSuiPrivateKey(secret).secretKey,
  );

  console.log(`Minting on Sui Testnet as ${suiSigner.toSuiAddress()}...`);

  const transaction = buildReceiveMessageTransaction({
    message: hexToBytes(message),
    attestation: hexToBytes(attestation),
  });

  const result = await suiClient.signAndExecuteTransaction({
    signer: suiSigner,
    transaction,
  });
  const digest =
    (result as { digest?: string }).digest ??
    (result as { Transaction?: { digest?: string } }).Transaction?.digest;
  if (!digest) {
    console.dir(result, { depth: null, colors: true });
    throw new Error("Sui mint did not return a digest");
  }
  await suiClient.waitForTransaction({ digest });
  console.log(`Mint confirmed: ${digest}`);
}

async function main() {
  const { sourceDomain, burnTransactionHash } = parseRecoverArgs(USAGE);
  const { message, attestation } = await retrieveAttestation(
    sourceDomain,
    burnTransactionHash,
  );
  await mintOnSui(message, attestation);
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
