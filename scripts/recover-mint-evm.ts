/**
 * Recover a CCTP mint on an EVM testnet from a prior burn.
 *
 * Put EVM_PRIVATE_KEY and DEST_CHAIN_ID in `.env` (see `.env.example`).
 *
 * Usage:
 *   npm run recover-mint:evm -- <sourceDomain> <burnTxHash>
 */

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import {
  CHAIN_CONFIGS,
  type SupportedChainId,
} from "../src/lib/chains";
import { parseRecoverArgs, retrieveAttestation } from "./lib/attestation";

const USAGE =
  "Usage: npm run recover-mint:evm -- <sourceDomain> <burnTxHash> (set EVM_PRIVATE_KEY and DEST_CHAIN_ID in .env)";

async function mintOnEvm(
  destinationChainId: SupportedChainId,
  message: Hex,
  attestation: Hex,
) {
  const privateKey = process.env.EVM_PRIVATE_KEY as Hex | undefined;
  if (!privateKey) {
    throw new Error("Set EVM_PRIVATE_KEY");
  }

  const config = CHAIN_CONFIGS[destinationChainId];
  if (!config?.viemChain || config.ecosystem !== "evm") {
    throw new Error(`DEST_CHAIN_ID ${destinationChainId} is not an EVM chain in CHAIN_CONFIGS`);
  }

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({
    chain: config.viemChain,
    transport: http(),
  });
  const walletClient = createWalletClient({
    account,
    chain: config.viemChain,
    transport: http(),
  });

  console.log(`Minting on ${config.name} as ${account.address}...`);

  const hash = await walletClient.writeContract({
    address: config.messageTransmitter as Hex,
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
    functionName: "receiveMessage",
    args: [message, attestation],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Mint reverted: ${hash}`);
  }
  console.log(`Mint confirmed: ${hash}`);
}

async function main() {
  const { sourceDomain, burnTransactionHash } = parseRecoverArgs(USAGE);
  const destArg = process.env.DEST_CHAIN_ID;
  if (!destArg) {
    throw new Error("Set DEST_CHAIN_ID to a SupportedChainId (e.g. 11155111 for Ethereum Sepolia)");
  }
  const destinationChainId = Number(destArg) as SupportedChainId;

  const { message, attestation } = await retrieveAttestation(
    sourceDomain,
    burnTransactionHash,
  );
  await mintOnEvm(destinationChainId, message, attestation);
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
