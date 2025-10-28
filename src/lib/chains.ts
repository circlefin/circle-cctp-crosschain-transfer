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

import type { Hex } from "viem";

export enum SupportedChainId {
  ETH_SEPOLIA = 11155111,
  ARC_TESTNET = 5042002,
  AVAX_FUJI = 43113,
  BASE_SEPOLIA = 84532,
  SONIC_TESTNET = 14601,
  LINEA_SEPOLIA = 59141,
  ARBITRUM_SEPOLIA = 421614,
  WORLDCHAIN_SEPOLIA = 4801,
  OPTIMISM_SEPOLIA = 11155420,
  SOLANA_DEVNET = 103,
  CODEX_TESTNET = 812242,
  UNICHAIN_SEPOLIA = 1301,
  POLYGON_AMOY = 80002,
  SEI_TESTNET = 1328,
  XDC_TESTNET = 51,
  PLUME_SEPOLIA = 98867,
  HYPEREVM_TESTNET = 998,
  INK_SEPOLIA = 763373,
}

export const DEFAULT_MAX_FEE = 1000n;
export const DEFAULT_FINALITY_THRESHOLD = 2000;

export const CHAIN_TO_CHAIN_NAME: Record<number, string> = {
  [SupportedChainId.ETH_SEPOLIA]: "Ethereum Sepolia",
  [SupportedChainId.ARC_TESTNET]: "Arc Testnet",
  [SupportedChainId.AVAX_FUJI]: "Avalanche Fuji",
  [SupportedChainId.BASE_SEPOLIA]: "Base Sepolia",
  [SupportedChainId.SONIC_TESTNET]: "Sonic Testnet",
  [SupportedChainId.LINEA_SEPOLIA]: "Linea Sepolia",
  [SupportedChainId.ARBITRUM_SEPOLIA]: "Arbitrum Sepolia",
  [SupportedChainId.WORLDCHAIN_SEPOLIA]: "Worldchain Sepolia",
  [SupportedChainId.OPTIMISM_SEPOLIA]: "Optimism Sepolia",
  [SupportedChainId.SOLANA_DEVNET]: "Solana Devnet",
  [SupportedChainId.CODEX_TESTNET]: "Codex Testnet",
  [SupportedChainId.UNICHAIN_SEPOLIA]: "Unichain Sepolia",
  [SupportedChainId.POLYGON_AMOY]: "Polygon Amoy",
  [SupportedChainId.SEI_TESTNET]: "Sei Testnet",
  [SupportedChainId.XDC_TESTNET]: "XDC Testnet",
  [SupportedChainId.PLUME_SEPOLIA]: "Plume Sepolia",
  [SupportedChainId.HYPEREVM_TESTNET]: "HyperEvm Testnet",
  [SupportedChainId.INK_SEPOLIA]: "Ink Sepolia",
};

export const CHAIN_IDS_TO_USDC_ADDRESSES: Record<number, Hex | string> = {
  [SupportedChainId.ETH_SEPOLIA]: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
  [SupportedChainId.ARC_TESTNET]: "0x3600000000000000000000000000000000000000",
  [SupportedChainId.AVAX_FUJI]: "0x5425890298aed601595a70AB815c96711a31Bc65",
  [SupportedChainId.BASE_SEPOLIA]: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  [SupportedChainId.SONIC_TESTNET]: "0x0BA304580ee7c9a980CF72e55f5Ed2E9fd30Bc51",
  [SupportedChainId.LINEA_SEPOLIA]: "0xFEce4462D57bD51A6A552365A011b95f0E16d9B7",
  [SupportedChainId.ARBITRUM_SEPOLIA]: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  [SupportedChainId.WORLDCHAIN_SEPOLIA]: "0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88",
  [SupportedChainId.OPTIMISM_SEPOLIA]: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
  [SupportedChainId.SOLANA_DEVNET]: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  [SupportedChainId.CODEX_TESTNET]: "0x6d7f141b6819C2c9CC2f818e6ad549E7Ca090F8f",
  [SupportedChainId.UNICHAIN_SEPOLIA]: "0x31d0220469e10c4E71834a79b1f276d740d3768F",
  [SupportedChainId.POLYGON_AMOY]: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
  [SupportedChainId.SEI_TESTNET]: "0x4fCF1784B31630811181f670Aea7A7bEF803eaED",
  [SupportedChainId.XDC_TESTNET]: "0xb5AB69F7bBada22B28e79C8FFAECe55eF1c771D4",
  [SupportedChainId.PLUME_SEPOLIA]: "0xcB5f30e335672893c7eb944B374c196392C19D18",
  [SupportedChainId.HYPEREVM_TESTNET]: "0x2B3370eE501B4a559b57D449569354196457D8Ab",
  [SupportedChainId.INK_SEPOLIA]: "0xFabab97dCE620294D2B0b0e46C68964e326300Ac",
};

export const CHAIN_IDS_TO_TOKEN_MESSENGER: Record<number, Hex | string> = {
  [SupportedChainId.ETH_SEPOLIA]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.ARC_TESTNET]: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
  [SupportedChainId.AVAX_FUJI]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.BASE_SEPOLIA]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.SONIC_TESTNET]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.LINEA_SEPOLIA]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.ARBITRUM_SEPOLIA]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.WORLDCHAIN_SEPOLIA]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.OPTIMISM_SEPOLIA]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.SOLANA_DEVNET]: "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe",
  [SupportedChainId.CODEX_TESTNET]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.UNICHAIN_SEPOLIA]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.POLYGON_AMOY]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.SEI_TESTNET]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.XDC_TESTNET]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.PLUME_SEPOLIA]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.HYPEREVM_TESTNET]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
  [SupportedChainId.INK_SEPOLIA]: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
};

export const CHAIN_IDS_TO_MESSAGE_TRANSMITTER: Record<number, Hex | string> = {
  [SupportedChainId.ETH_SEPOLIA]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.ARC_TESTNET]: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
  [SupportedChainId.AVAX_FUJI]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.BASE_SEPOLIA]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.SONIC_TESTNET]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.LINEA_SEPOLIA]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.ARBITRUM_SEPOLIA]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.WORLDCHAIN_SEPOLIA]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.OPTIMISM_SEPOLIA]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.SOLANA_DEVNET]: "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC",
  [SupportedChainId.CODEX_TESTNET]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.UNICHAIN_SEPOLIA]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.POLYGON_AMOY]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.SEI_TESTNET]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.XDC_TESTNET]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.PLUME_SEPOLIA]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.HYPEREVM_TESTNET]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
  [SupportedChainId.INK_SEPOLIA]: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
};

export const DESTINATION_DOMAINS: Record<number, number> = {
  [SupportedChainId.ETH_SEPOLIA]: 0,
  [SupportedChainId.ARC_TESTNET]: 26,
  [SupportedChainId.AVAX_FUJI]: 1,
  [SupportedChainId.BASE_SEPOLIA]: 6,
  [SupportedChainId.SONIC_TESTNET]: 13,
  [SupportedChainId.LINEA_SEPOLIA]: 11,
  [SupportedChainId.ARBITRUM_SEPOLIA]: 3,
  [SupportedChainId.WORLDCHAIN_SEPOLIA]: 14,
  [SupportedChainId.OPTIMISM_SEPOLIA]: 2,
  [SupportedChainId.SOLANA_DEVNET]: 5,
  [SupportedChainId.CODEX_TESTNET]: 12,
  [SupportedChainId.UNICHAIN_SEPOLIA]: 10,
  [SupportedChainId.POLYGON_AMOY]: 7,
  [SupportedChainId.SEI_TESTNET]: 16,
  [SupportedChainId.XDC_TESTNET]: 18,
  [SupportedChainId.PLUME_SEPOLIA]: 22,
  [SupportedChainId.HYPEREVM_TESTNET]: 19,
  [SupportedChainId.INK_SEPOLIA]: 21,
};

export const SUPPORTED_CHAINS = [
  SupportedChainId.ARC_TESTNET,
  SupportedChainId.ETH_SEPOLIA,
  SupportedChainId.AVAX_FUJI,
  SupportedChainId.BASE_SEPOLIA,
  SupportedChainId.SONIC_TESTNET,
  SupportedChainId.LINEA_SEPOLIA,
  SupportedChainId.ARBITRUM_SEPOLIA,
  SupportedChainId.WORLDCHAIN_SEPOLIA,
  SupportedChainId.OPTIMISM_SEPOLIA,
  SupportedChainId.SOLANA_DEVNET,
  SupportedChainId.CODEX_TESTNET,
  SupportedChainId.UNICHAIN_SEPOLIA,
  SupportedChainId.POLYGON_AMOY,
  SupportedChainId.SEI_TESTNET,
  SupportedChainId.XDC_TESTNET,
  SupportedChainId.PLUME_SEPOLIA,
  SupportedChainId.HYPEREVM_TESTNET,
  SupportedChainId.INK_SEPOLIA,
];

// Solana RPC endpoint
export const SOLANA_RPC_ENDPOINT = "https://api.devnet.solana.com";

// IRIS API URL for CCTP attestations (testnet)
export const IRIS_API_URL = process.env.IRIS_API_URL ?? "https://iris-api-sandbox.circle.com";
