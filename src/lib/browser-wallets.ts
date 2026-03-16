"use client";

import { custom, createWalletClient, type Hex } from "viem";
import { type PublicKey, type Transaction, type VersionedTransaction } from "@solana/web3.js";

import { CHAIN_CONFIGS, type SupportedChainId } from "@/lib/chains";

export type EvmClient = ReturnType<typeof createWalletClient>;

export interface EvmProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export interface EvmProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns?: string;
}

export interface EvmProviderOption {
  info: EvmProviderInfo;
  provider: EvmProvider;
}

export interface SolanaProvider {
  publicKey: PublicKey | null;
  connect(): Promise<{ publicKey: PublicKey }>;
  disconnect?: () => Promise<void>;
  signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>;
  signAllTransactions?<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>;
}

export interface EvmWalletConnection {
  address: Hex;
  provider: EvmProvider;
  providerInfo?: EvmProviderInfo;
}

export interface SolanaWalletConnection {
  address: string;
  provider: SolanaProvider;
}

export interface WalletConnections {
  evm: EvmWalletConnection | null;
  solana: SolanaWalletConnection | null;
}

declare global {
  interface WindowEventMap {
    "eip6963:announceProvider": CustomEvent<EvmProviderOption>;
  }

  interface Window {
    ethereum?: EvmProvider;
    solana?: SolanaProvider;
  }
}

export async function discoverEvmWallets(): Promise<EvmProviderOption[]> {
  const providers = new Map<string, EvmProviderOption>();

  const handleProvider = (event: WindowEventMap["eip6963:announceProvider"]) => {
    const { info, provider } = event.detail;
    providers.set(info.uuid, { info, provider });
  };

  window.addEventListener("eip6963:announceProvider", handleProvider);
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  await new Promise((resolve) => setTimeout(resolve, 200));

  window.removeEventListener("eip6963:announceProvider", handleProvider);

  if (providers.size === 0 && window.ethereum) {
    providers.set("window-ethereum", {
      info: {
        uuid: "window-ethereum",
        name: "Injected Wallet",
        icon: "",
      },
      provider: window.ethereum,
    });
  }

  return Array.from(providers.values());
}

export async function connectEvmWallet(
  selectedProvider?: EvmProviderOption
): Promise<EvmWalletConnection> {
  const providerOption =
    selectedProvider ??
    (await discoverEvmWallets()).at(0);
  const provider = providerOption?.provider;
  if (!provider) {
    throw new Error("No EVM wallet detected");
  }

  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  const address = accounts?.[0] as Hex | undefined;

  if (!address) {
    throw new Error("No EVM account returned by wallet");
  }

  return { address, provider, providerInfo: providerOption?.info };
}

export async function connectSolanaWallet(): Promise<SolanaWalletConnection> {
  const provider = window.solana;
  if (!provider) {
    throw new Error("No Solana wallet detected");
  }

  const response = await provider.connect();
  const address = response.publicKey?.toString();
  if (!address) {
    throw new Error("No Solana account returned by wallet");
  }

  return { address, provider };
}

export async function disconnectSolanaWallet(
  connection: SolanaWalletConnection | null
) {
  await connection?.provider.disconnect?.();
}

export async function ensureEvmChain(
  provider: EvmProvider,
  chainId: SupportedChainId
) {
  await provider.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: `0x${chainId.toString(16)}` }],
  });
}

export function getEvmWalletClient(
  connection: EvmWalletConnection,
  chainId: SupportedChainId
): EvmClient {
  const chain = CHAIN_CONFIGS[chainId].viemChain;
  if (!chain) {
    throw new Error(`Unsupported EVM chain: ${chainId}`);
  }

  return createWalletClient({
    account: connection.address,
    chain,
    transport: custom(connection.provider),
  });
}
