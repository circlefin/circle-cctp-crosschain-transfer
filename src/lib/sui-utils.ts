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

import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { formatUnits, type Hex } from "viem";

import {
  CHAIN_CONFIGS,
  SUI_CCTP_TESTNET,
  SUI_RPC_ENDPOINT,
  SupportedChainId,
} from "@/lib/chains";

const suiClient = new SuiGrpcClient({
  network: "testnet",
  baseUrl: SUI_RPC_ENDPOINT,
});

export type SuiWalletSigner = {
  address: string;
  signAndExecuteTransaction(transaction: Transaction): Promise<{ digest: string }>;
};

export function getSuiClient() {
  return suiClient;
}

export function getSuiUsdcType() {
  const packageId = CHAIN_CONFIGS[SupportedChainId.SUI_TESTNET]
    .usdcAddress as string;
  return `${packageId}::usdc::USDC`;
}

export function padAddressToBytes32(address: string): Hex {
  return `0x${address.replace(/^0x/, "").padStart(64, "0").toLowerCase()}` as Hex;
}

export function buildDepositForBurnTransaction(params: {
  amount: bigint;
  destinationDomain: number;
  mintRecipient: string;
  maxFee: bigint;
  minFinalityThreshold: number;
}): Transaction {
  const config = CHAIN_CONFIGS[SupportedChainId.SUI_TESTNET];
  const tmmPackageId = config.tokenMessenger as string;
  const usdcType = getSuiUsdcType();
  const tx = new Transaction();

  // SIP-58: redeem from address balance into a Coin for the burn.
  const [coin] = tx.moveCall({
    target: "0x2::coin::redeem_funds",
    typeArguments: [usdcType],
    arguments: [tx.withdrawal({ amount: params.amount, type: usdcType })],
  });

  const [burnReceipt, returnedCoin] = tx.moveCall({
    target: `${tmmPackageId}::deposit_for_burn::deposit_for_burn`,
    arguments: [
      coin,
      tx.pure.u32(params.destinationDomain),
      tx.pure.address(padAddressToBytes32(params.mintRecipient)),
      tx.pure.address("0x0"),
      tx.pure.u256(params.maxFee),
      tx.pure.u32(params.minFinalityThreshold),
      tx.pure.vector("u8", []),
      tx.object(SUI_CCTP_TESTNET.tmmV2StateId),
    ],
    typeArguments: [usdcType],
  });

  const [completeBurnTicket] = tx.moveCall({
    target: `${SUI_CCTP_TESTNET.handlerPackageId}::handler::burn`,
    arguments: [
      tx.object(SUI_CCTP_TESTNET.handlerStateId),
      burnReceipt,
      returnedCoin,
      tx.object(SUI_CCTP_TESTNET.denyListId),
      tx.object(SUI_CCTP_TESTNET.treasuryId),
    ],
  });

  tx.moveCall({
    target: `${tmmPackageId}::deposit_for_burn::complete_burn`,
    arguments: [
      completeBurnTicket,
      tx.object(SUI_CCTP_TESTNET.tmmV2StateId),
      tx.object(SUI_CCTP_TESTNET.mtV2StateId),
    ],
    typeArguments: [
      usdcType,
      `${SUI_CCTP_TESTNET.handlerPackageId}::handler::Auth`,
    ],
  });

  return tx;
}

export function buildReceiveMessageTransaction(params: {
  message: Uint8Array;
  attestation: Uint8Array;
}): Transaction {
  const config = CHAIN_CONFIGS[SupportedChainId.SUI_TESTNET];
  const tmmPackageId = config.tokenMessenger as string;
  const mtPackageId = config.messageTransmitter as string;
  const usdcType = getSuiUsdcType();
  const tx = new Transaction();

  const [receipt] = tx.moveCall({
    target: `${mtPackageId}::receive_message::receive_message`,
    arguments: [
      tx.pure.vector("u8", Array.from(params.message)),
      tx.pure.vector("u8", Array.from(params.attestation)),
      tx.object(SUI_CCTP_TESTNET.mtV2StateId),
    ],
  });

  const [mintReceipt] = tx.moveCall({
    target: `${tmmPackageId}::handle_receive_message::prepare_mint`,
    arguments: [
      receipt,
      tx.object(SUI_CCTP_TESTNET.tmmV2StateId),
      tx.object(SUI_CCTP_TESTNET.clockId),
    ],
    typeArguments: [usdcType],
  });

  const [completeMintTicket] = tx.moveCall({
    target: `${SUI_CCTP_TESTNET.handlerPackageId}::handler::mint`,
    arguments: [
      tx.object(SUI_CCTP_TESTNET.handlerStateId),
      mintReceipt,
      tx.object(SUI_CCTP_TESTNET.tmmV2StateId),
      tx.object(SUI_CCTP_TESTNET.treasuryId),
      tx.object(SUI_CCTP_TESTNET.denyListId),
    ],
  });

  tx.moveCall({
    target: `${tmmPackageId}::handle_receive_message::complete_mint`,
    arguments: [
      completeMintTicket,
      tx.object(SUI_CCTP_TESTNET.tmmV2StateId),
      tx.object(SUI_CCTP_TESTNET.mtV2StateId),
    ],
    typeArguments: [
      usdcType,
      `${SUI_CCTP_TESTNET.handlerPackageId}::handler::Auth`,
    ],
  });

  return tx;
}

export async function signAndExecuteSuiTransaction(
  wallet: SuiWalletSigner,
  transaction: Transaction,
) {
  const { digest } = await wallet.signAndExecuteTransaction(transaction);
  // Sui digests are Base58 — never hex-prefix (breaks getTransaction / fold).
  await suiClient.waitForTransaction({ digest });
  return digest;
}

export async function getSuiUsdcBalance(ownerAddress: string) {
  const { balance } = await suiClient.getBalance({
    owner: ownerAddress,
    coinType: getSuiUsdcType(),
  });
  return formatUnits(BigInt(balance.balance), 6);
}

/** Fold a freshly minted Coin into a SIP-58 address balance when possible. */
export async function foldMintedUsdcIntoAddressBalance(
  wallet: SuiWalletSigner,
  digest: string,
) {
  const coinObjectId = await findCreatedUsdcCoin(digest, wallet.address);
  if (!coinObjectId) {
    return null;
  }

  const usdcType = getSuiUsdcType();
  const foldTx = new Transaction();
  foldTx.moveCall({
    target: "0x2::coin::send_funds",
    typeArguments: [usdcType],
    arguments: [
      foldTx.object(coinObjectId),
      foldTx.pure.address(wallet.address),
    ],
  });
  return signAndExecuteSuiTransaction(wallet, foldTx);
}

async function findCreatedUsdcCoin(digest: string, owner: string) {
  const result = await suiClient.core.getTransaction({
    digest,
    include: { effects: true, objectTypes: true },
  });
  const tx =
    result.$kind === "Transaction"
      ? result.Transaction
      : result.FailedTransaction;
  if (!tx?.effects?.changedObjects || !tx.objectTypes) {
    return null;
  }

  const normalizedOwner = normalizeSuiAddress(owner);
  const created = tx.effects.changedObjects.find((obj) => {
    if (obj.idOperation !== "Created") {
      return false;
    }
    const type = tx.objectTypes?.[obj.objectId] ?? "";
    if (!type.includes("::coin::Coin<") || !type.includes("::usdc::USDC")) {
      return false;
    }
    if (obj.outputOwner?.$kind !== "AddressOwner") {
      return false;
    }
    return normalizeSuiAddress(obj.outputOwner.AddressOwner) === normalizedOwner;
  });

  return created?.objectId ?? null;
}
