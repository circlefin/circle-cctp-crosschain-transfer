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

import { type Chain, type Hex, defineChain } from "viem";
import {
  arbitrumSepolia,
  arcTestnet,
  avalancheFuji,
  baseSepolia,
  codexTestnet,
  cronosTestnet,
  hyperliquidEvmTestnet,
  injectiveTestnet,
  inkSepolia,
  lineaSepolia,
  monadTestnet,
  optimismSepolia,
  plasmaTestnet,
  plumeSepolia,
  polygonAmoy,
  seiTestnet,
  sepolia,
  unichainSepolia,
  worldchainSepolia,
  xdcTestnet,
  xLayerTestnet,
} from "viem/chains";

export enum SupportedChainId {
  ARBITRUM_SEPOLIA = 421614,
  ARC_TESTNET = 5042002,
  APTOS_TESTNET = 999, // placeholder — Aptos is not EVM
  AVAX_FUJI = 43113,
  BASE_SEPOLIA = 84532,
  CODEX_TESTNET = 812242,
  CRONOS_TESTNET = 338,
  EDGE_TESTNET = 33431,
  ETH_SEPOLIA = 11155111,
  HYPEREVM_TESTNET = 998,
  INJECTIVE_TESTNET = 1439,
  INK_SEPOLIA = 763373,
  LINEA_SEPOLIA = 59141,
  MONAD_TESTNET = 10143,
  MORPH_HOODI = 2910,
  OPTIMISM_SEPOLIA = 11155420,
  PHAROS_ATLANTIC = 688689,
  PLASMA_TESTNET = 9746,
  PLUME_SEPOLIA = 98867,
  POLYGON_AMOY = 80002,
  SEI_TESTNET = 1328,
  SOLANA_DEVNET = 103, // placeholder — Solana is not EVM
  SONIC_TESTNET = 14601,
  UNICHAIN_SEPOLIA = 1301,
  WORLDCHAIN_SEPOLIA = 4801,
  XDC_TESTNET = 51,
  XLAYER_TESTNET = 1952,
}

export type Ecosystem = "evm" | "solana" | "aptos" | "stellar";

export interface ChainConfig {
  name: string;
  ecosystem: Ecosystem;
  viemChain?: Chain;
  usdcAddress: Hex | string;
  tokenMessenger: Hex | string;
  messageTransmitter: Hex | string;
  destinationDomain: number;
}

const edgeTestnet = defineChain({
  id: 33431,
  name: "Edge Testnet",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: { default: { http: ["https://edge-testnet.g.alchemy.com/public"] } },
  blockExplorers: {
    default: { name: "Edge Testnet Explorer", url: "https://edge-testnet.explorer.alchemy.com/" },
  },
  testnet: true,
});

const morphHoodi = defineChain({
  id: 2910,
  name: "Morph Hoodi",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: { default: { http: ["https://rpc-hoodi.morph.network"] } },
  blockExplorers: {
    default: { name: "Morph Hoodi Explorer", url: "https://explorer-hoodi.morph.network" },
  },
  testnet: true,
});

const pharosAtlantic = defineChain({
  id: 688689,
  name: "Pharos Atlantic",
  nativeCurrency: { decimals: 18, name: "PHRS", symbol: "PHRS" },
  rpcUrls: { default: { http: ["https://atlantic.dplabs-internal.com"] } },
  blockExplorers: {
    default: {
      name: "Pharos Testnet Explorer",
      url: "https://atlantic.pharosscan.xyz/",
    },
  },
  testnet: true,
});

/** viem's sonicTestnet still uses chain id 64165; Sonic Testnet is 14601. */
const sonicTestnet = defineChain({
  id: 14601,
  name: "Sonic Testnet",
  nativeCurrency: { decimals: 18, name: "Sonic", symbol: "S" },
  rpcUrls: { default: { http: ["https://rpc.testnet.soniclabs.com"] } },
  blockExplorers: {
    default: {
      name: "SonicScan",
      url: "https://testnet.sonicscan.org",
      apiUrl: "https://api.etherscan.io/v2/api?chainid=14601",
    },
  },
  testnet: true,
});

export const CHAIN_CONFIGS: Record<SupportedChainId, ChainConfig> = {
  [SupportedChainId.ARBITRUM_SEPOLIA]: {
    name: "Arbitrum Sepolia",
    ecosystem: "evm",
    viemChain: arbitrumSepolia,
    usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    destinationDomain: 3,
  },
  [SupportedChainId.ARC_TESTNET]: {
    name: "Arc Testnet",
    ecosystem: "evm",
    viemChain: arcTestnet,
    usdcAddress: "0x3600000000000000000000000000000000000000",
    tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
    messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
    destinationDomain: 26,
  },
  [SupportedChainId.APTOS_TESTNET]: {
    name: "Aptos Testnet",
    ecosystem: "aptos",
    usdcAddress:
      "0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832",
    tokenMessenger:
      "0xc601d3f7b89b77b552726d5d84cbf2a6d3e8a73adbbee3f09fad169a3286bb59",
    messageTransmitter:
      "0xa582dc019ae17b0485f7d3fcc4ca85bea7941e3b70a4b682cea22759f36e711f",
    destinationDomain: 9,
  },
  [SupportedChainId.AVAX_FUJI]: {
    name: "Avalanche Fuji",
    ecosystem: "evm",
    viemChain: avalancheFuji,
    usdcAddress: "0x5425890298aed601595a70AB815c96711a31Bc65",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    destinationDomain: 1,
  },
  [SupportedChainId.BASE_SEPOLIA]: {
    name: "Base Sepolia",
    ecosystem: "evm",
    viemChain: baseSepolia,
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    destinationDomain: 6,
  },
  [SupportedChainId.CODEX_TESTNET]: {
    name: "Codex Testnet",
    ecosystem: "evm",
    viemChain: codexTestnet,
    usdcAddress: "0x6d7f141b6819C2c9CC2f818e6ad549E7Ca090F8f",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    destinationDomain: 12,
  },
  [SupportedChainId.CRONOS_TESTNET]: {
    name: "Cronos Testnet",
    ecosystem: "evm",
    viemChain: cronosTestnet,
    usdcAddress: "0xEb33dc5fac03833e132593659e1dE7256aB59794",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    destinationDomain: 32,
  },
  [SupportedChainId.EDGE_TESTNET]: {
    name: "Edge Testnet",
    ecosystem: "evm",
    viemChain: edgeTestnet,
    usdcAddress: "0x2d9F7CAD728051AA35Ecdc472a14cf8cDF5CFD6B",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    destinationDomain: 28,
  },
  [SupportedChainId.ETH_SEPOLIA]: {
    name: "Ethereum Sepolia",
    ecosystem: "evm",
    viemChain: sepolia,
    usdcAddress: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    destinationDomain: 0,
  },
  [SupportedChainId.HYPEREVM_TESTNET]: {
    name: "HyperEvm Testnet",
    ecosystem: "evm",
    viemChain: hyperliquidEvmTestnet,
    usdcAddress: "0x2B3370eE501B4a559b57D449569354196457D8Ab",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    destinationDomain: 19,
  },
  [SupportedChainId.INJECTIVE_TESTNET]: {
    name: "Injective Testnet",
    ecosystem: "evm",
    viemChain: injectiveTestnet,
    usdcAddress: "0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d",
    tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
    messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
    destinationDomain: 29,
  },
  [SupportedChainId.INK_SEPOLIA]: {
    name: "Ink Sepolia",
    ecosystem: "evm",
    viemChain: inkSepolia,
    usdcAddress: "0xFabab97dCE620294D2B0b0e46C68964e326300Ac",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    destinationDomain: 21,
  },
  [SupportedChainId.LINEA_SEPOLIA]: {
    name: "Linea Sepolia",
    ecosystem: "evm",
    viemChain: lineaSepolia,
    usdcAddress: "0xFEce4462D57bD51A6A552365A011b95f0E16d9B7",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    destinationDomain: 11,
  },
  [SupportedChainId.MONAD_TESTNET]: {
    name: "Monad Testnet",
    ecosystem: "evm",
    viemChain: monadTestnet,
    usdcAddress: "0x534b2f3a21130d7a60830c2df862319e593943a3",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    destinationDomain: 15,
  },
  [SupportedChainId.MORPH_HOODI]: {
    name: "Morph Hoodi",
    ecosystem: "evm",
    viemChain: morphHoodi,
    usdcAddress: "0x7433b41C6c5e1d58D4Da99483609520255ab661B",
    tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
    messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
    destinationDomain: 30,
  },
  [SupportedChainId.OPTIMISM_SEPOLIA]: {
    name: "Optimism Sepolia",
    ecosystem: "evm",
    viemChain: optimismSepolia,
    usdcAddress: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    destinationDomain: 2,
  },
  [SupportedChainId.PHAROS_ATLANTIC]: {
    name: "Pharos Atlantic",
    ecosystem: "evm",
    viemChain: pharosAtlantic,
    usdcAddress: "0xcfc8330f4bcab529c625d12781b1c19466a9fc8b",
    tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
    messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
    destinationDomain: 31,
  },
  [SupportedChainId.PLASMA_TESTNET]: {
    name: "Plasma Testnet",
    ecosystem: "evm",
    viemChain: plasmaTestnet,
    usdcAddress: "0xe67fb267022cba8064dd388cc2fed724f3120d9d",
    tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
    messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
    destinationDomain: 33,
  },
  [SupportedChainId.PLUME_SEPOLIA]: {
    name: "Plume Sepolia",
    ecosystem: "evm",
    viemChain: plumeSepolia,
    usdcAddress: "0xcB5f30e335672893c7eb944B374c196392C19D18",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    destinationDomain: 22,
  },
  [SupportedChainId.POLYGON_AMOY]: {
    name: "Polygon Amoy",
    ecosystem: "evm",
    viemChain: polygonAmoy,
    usdcAddress: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    destinationDomain: 7,
  },
  [SupportedChainId.SEI_TESTNET]: {
    name: "Sei Testnet",
    ecosystem: "evm",
    viemChain: seiTestnet,
    usdcAddress: "0x4fCF1784B31630811181f670Aea7A7bEF803eaED",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    destinationDomain: 16,
  },
  [SupportedChainId.SOLANA_DEVNET]: {
    name: "Solana Devnet",
    ecosystem: "solana",
    usdcAddress: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    tokenMessenger: "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe",
    messageTransmitter: "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC",
    destinationDomain: 5,
  },
  [SupportedChainId.SONIC_TESTNET]: {
    name: "Sonic Testnet",
    ecosystem: "evm",
    viemChain: sonicTestnet,
    usdcAddress: "0x0BA304580ee7c9a980CF72e55f5Ed2E9fd30Bc51",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    destinationDomain: 13,
  },
  [SupportedChainId.UNICHAIN_SEPOLIA]: {
    name: "Unichain Sepolia",
    ecosystem: "evm",
    viemChain: unichainSepolia,
    usdcAddress: "0x31d0220469e10c4E71834a79b1f276d740d3768F",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    destinationDomain: 10,
  },
  [SupportedChainId.WORLDCHAIN_SEPOLIA]: {
    name: "Worldchain Sepolia",
    ecosystem: "evm",
    viemChain: worldchainSepolia,
    usdcAddress: "0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    destinationDomain: 14,
  },
  [SupportedChainId.XDC_TESTNET]: {
    name: "XDC Testnet",
    ecosystem: "evm",
    viemChain: xdcTestnet,
    usdcAddress: "0xb5AB69F7bBada22B28e79C8FFAECe55eF1c771D4",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    destinationDomain: 18,
  },
  [SupportedChainId.XLAYER_TESTNET]: {
    name: "XLayer Testnet",
    ecosystem: "evm",
    viemChain: xLayerTestnet,
    usdcAddress: "0xdec90b78111ba2fc6fc6d84d8b9ec159a2d4b9b3",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    messageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    destinationDomain: 37,
  },
};

export const SUPPORTED_CHAINS = (Object.keys(CHAIN_CONFIGS).map(Number) as SupportedChainId[])
  .sort((a, b) => CHAIN_CONFIGS[a].name.localeCompare(CHAIN_CONFIGS[b].name));

export const SOLANA_RPC_ENDPOINT = "https://api.devnet.solana.com";

export const IRIS_API_URL = "https://iris-api-sandbox.circle.com";

/** Local precompiled Move scripts (served from /public). */
export const APTOS_DEPOSIT_FOR_BURN_SCRIPT_URL =
  "/aptos/precompiled-move-scripts/deposit_for_burn.mv";

export const APTOS_RECEIVE_MESSAGE_SCRIPT_URL =
  "/aptos/precompiled-move-scripts/receive_message.mv";
