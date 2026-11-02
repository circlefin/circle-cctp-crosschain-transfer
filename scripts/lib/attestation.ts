/**
 * Poll Iris sandbox for a CCTP V2 message + attestation.
 */

import { IRIS_API_URL } from "../../src/lib/chains";

export type Attestation = {
  message: `0x${string}`;
  attestation: `0x${string}`;
};

export function parseRecoverArgs(usage: string): {
  sourceDomain: number;
  burnTransactionHash: string;
} {
  const sourceDomainArg = process.argv[2];
  const burnTransactionHash = process.argv[3];
  if (!sourceDomainArg || !burnTransactionHash) {
    console.error(usage);
    process.exit(1);
  }
  const sourceDomain = Number(sourceDomainArg);
  if (!Number.isInteger(sourceDomain) || sourceDomain < 0) {
    throw new Error(`Invalid source domain: ${sourceDomainArg}`);
  }
  return { sourceDomain, burnTransactionHash };
}

export async function retrieveAttestation(
  sourceDomain: number,
  burnTransactionHash: string,
): Promise<Attestation> {
  const url = `${IRIS_API_URL}/v2/messages/${sourceDomain}?transactionHash=${burnTransactionHash}`;
  console.log(`Polling Iris for attestation: ${url}`);

  while (true) {
    const response = await fetch(url);
    if (!response.ok && response.status !== 404) {
      throw new Error(`Iris returned HTTP ${response.status}`);
    }

    if (response.ok) {
      const data = (await response.json()) as {
        messages?: Array<{ message?: string; attestation?: string }>;
      };
      const result = data.messages?.[0];
      if (
        result?.message &&
        result.attestation &&
        result.attestation !== "PENDING" &&
        result.message !== "0x"
      ) {
        return {
          message: result.message as `0x${string}`,
          attestation: result.attestation as `0x${string}`,
        };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}
