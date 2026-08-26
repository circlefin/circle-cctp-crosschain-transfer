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
  AccountAddress,
  Aptos,
  AptosConfig,
  MoveVector,
  Network,
  U32,
  U64,
} from "@aptos-labs/ts-sdk";
import {
  UserResponseStatus,
  type AptosWallet,
} from "@aptos-labs/wallet-standard";
import { formatUnits, type Hex } from "viem";

import {
  APTOS_DEPOSIT_FOR_BURN_SCRIPT_URL,
  APTOS_RECEIVE_MESSAGE_SCRIPT_URL,
  CHAIN_CONFIGS,
  SupportedChainId,
} from "@/lib/chains";

const aptosClient = new Aptos(new AptosConfig({ network: Network.TESTNET }));

export function getAptosClient() {
  return aptosClient;
}

export async function loadMoveScript(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load Move script: ${url} (${response.status})`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export function toBytes32AccountAddress(hexAddress: string): AccountAddress {
  return AccountAddress.from(
    `0x${hexAddress.replace(/^0x/, "").padStart(64, "0")}`,
  );
}

export function padAddressToBytes32(address: string): Hex {
  return `0x${address.replace(/^0x/, "").padStart(64, "0")}` as Hex;
}

export async function signAndSubmitAptosScript(
  wallet: AptosWallet,
  sender: string,
  input: {
    scriptUrl: string;
    functionArguments: Array<
      U64 | U32 | AccountAddress | ReturnType<typeof MoveVector.U8>
    >;
  },
) {
  const signFeature = wallet.features["aptos:signTransaction"];
  if (!signFeature) {
    throw new Error("Wallet does not support aptos:signTransaction");
  }

  const bytecode = await loadMoveScript(input.scriptUrl);
  const transaction = await aptosClient.transaction.build.simple({
    sender,
    data: {
      bytecode,
      functionArguments: input.functionArguments,
    },
  });

  const response = await signFeature.signTransaction(transaction);
  if (response.status !== UserResponseStatus.APPROVED) {
    throw new Error("Aptos transaction rejected");
  }

  const pending = await aptosClient.transaction.submit.simple({
    transaction,
    senderAuthenticator: response.args,
  });
  const executed = await aptosClient.waitForTransaction({
    transactionHash: pending.hash,
  });
  return executed.hash;
}

export async function getAptosUsdcBalance(ownerAddress: string) {
  const usdcMetadata = CHAIN_CONFIGS[SupportedChainId.APTOS_TESTNET]
    .usdcAddress as string;
  // Fullnode REST balance endpoint — avoids Aptos Indexer GraphQL rate limits.
  const amount = await aptosClient.getBalance({
    accountAddress: ownerAddress,
    asset: usdcMetadata,
  });
  return formatUnits(BigInt(amount), 6);
}

export { APTOS_DEPOSIT_FOR_BURN_SCRIPT_URL, APTOS_RECEIVE_MESSAGE_SCRIPT_URL };
