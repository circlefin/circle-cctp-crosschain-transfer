/**
 * Recover a CCTP mint on Aptos Testnet from a prior burn.
 *
 * Put APTOS_PRIVATE_KEY in `.env` (see `.env.example`).
 *
 * Usage:
 *   npm run recover-mint:aptos -- <sourceDomain> <burnTxHash>
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  Account,
  Aptos,
  AptosConfig,
  Ed25519PrivateKey,
  MoveVector,
  Network,
} from "@aptos-labs/ts-sdk";

import { parseRecoverArgs, retrieveAttestation } from "./lib/attestation";

const USAGE =
  "Usage: npm run recover-mint:aptos -- <sourceDomain> <burnTxHash> (set APTOS_PRIVATE_KEY in .env)";

const RECEIVE_MESSAGE_SCRIPT = resolve(
  import.meta.dirname,
  "../public/aptos/precompiled-move-scripts/receive_message.mv",
);

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Uint8Array.from(Buffer.from(normalized, "hex"));
}

async function mintOnAptos(message: string, attestation: string) {
  const secret = process.env.APTOS_PRIVATE_KEY;
  if (!secret) {
    throw new Error("Set APTOS_PRIVATE_KEY");
  }

  const account = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(secret),
  });
  const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }));
  const bytecode = readFileSync(RECEIVE_MESSAGE_SCRIPT);

  console.log(`Minting on Aptos Testnet as ${account.accountAddress}...`);

  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      bytecode,
      functionArguments: [
        MoveVector.U8(hexToBytes(message)),
        MoveVector.U8(hexToBytes(attestation)),
      ],
    },
  });

  const pending = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction,
  });
  const executed = await aptos.waitForTransaction({
    transactionHash: pending.hash,
  });
  if (!executed.success) {
    throw new Error(`Mint failed: ${pending.hash}`);
  }
  console.log(`Mint confirmed: ${executed.hash}`);
}

async function main() {
  const { sourceDomain, burnTransactionHash } = parseRecoverArgs(USAGE);
  const { message, attestation } = await retrieveAttestation(
    sourceDomain,
    burnTransactionHash,
  );
  await mintOnAptos(message, attestation);
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
