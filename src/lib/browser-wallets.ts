"use client";

import {
  getWallets,
  type Wallet,
  type WalletAccount,
} from "@wallet-standard/core";
import {
  getAptosWallets,
  UserResponseStatus,
  type AptosWallet,
} from "@aptos-labs/wallet-standard";
import {
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { custom, createWalletClient, type Hex } from "viem";

import { CHAIN_CONFIGS, type SupportedChainId } from "@/lib/chains";

export type EvmClient = ReturnType<typeof createWalletClient>;

const SOLANA_DEVNET_CHAIN = "solana:devnet";

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

export interface EvmWalletConnection {
  address: Hex;
  provider: EvmProvider;
  providerInfo?: EvmProviderInfo;
}

export interface SolanaWalletConnection {
  address: string;
  publicKey: PublicKey;
  walletName: string;
  signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T,
  ): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(
    transactions: T[],
  ): Promise<T[]>;
  disconnect(): Promise<void>;
}

export interface AptosWalletConnection {
  address: string;
  walletName: string;
  wallet: AptosWallet;
  disconnect(): Promise<void>;
}

/** Placeholder until Stellar wallet connect is wired. */
export interface StellarWalletConnection {
  address: string;
}

export interface WalletConnections {
  evm: EvmWalletConnection | null;
  solana: SolanaWalletConnection | null;
  aptos: AptosWalletConnection | null;
  stellar: StellarWalletConnection | null;
}

type SolanaSignTransactionFeature = {
  signTransaction(input: {
    account: WalletAccount;
    transaction: Uint8Array;
    chain?: string;
  }): Promise<readonly { signedTransaction: Uint8Array }[]>;
};

type StandardConnectFeature = {
  connect(): Promise<{ accounts: readonly WalletAccount[] }>;
};

type StandardDisconnectFeature = {
  disconnect(): Promise<void>;
};

declare global {
  interface WindowEventMap {
    "eip6963:announceProvider": CustomEvent<EvmProviderOption>;
  }

  interface Window {
    ethereum?: EvmProvider;
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

function isSolanaWallet(wallet: Wallet): boolean {
  return "solana:signTransaction" in wallet.features;
}

export async function discoverSolanaWallets(): Promise<Wallet[]> {
  // Triggers wallet-standard:app-ready / register-wallet handshake.
  const { get } = getWallets();
  await new Promise((resolve) => setTimeout(resolve, 200));
  return get().filter(isSolanaWallet);
}

function serializeSolanaTransaction(
  transaction: Transaction | VersionedTransaction,
): Uint8Array {
  if ("version" in transaction) {
    return transaction.serialize();
  }
  return transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
}

function deserializeSolanaTransaction<
  T extends Transaction | VersionedTransaction,
>(original: T, bytes: Uint8Array): T {
  if ("version" in original) {
    return VersionedTransaction.deserialize(bytes) as T;
  }
  return Transaction.from(bytes) as T;
}

export async function connectSolanaWallet(
  selectedWallet?: Wallet,
): Promise<SolanaWalletConnection> {
  const wallet = selectedWallet ?? (await discoverSolanaWallets()).at(0);
  if (!wallet) {
    throw new Error("No Solana wallet detected");
  }

  const connectFeature = wallet.features["standard:connect"] as
    | StandardConnectFeature
    | undefined;
  if (!connectFeature) {
    throw new Error(`${wallet.name} does not support standard:connect`);
  }

  const { accounts } = await connectFeature.connect();
  const account = accounts[0];
  if (!account) {
    throw new Error("No Solana account returned by wallet");
  }

  const signFeature = wallet.features["solana:signTransaction"] as
    | SolanaSignTransactionFeature
    | undefined;
  if (!signFeature) {
    throw new Error(`${wallet.name} does not support solana:signTransaction`);
  }

  const signTransaction = async <T extends Transaction | VersionedTransaction>(
    transaction: T,
  ): Promise<T> => {
    const [result] = await signFeature.signTransaction({
      account,
      chain: SOLANA_DEVNET_CHAIN,
      transaction: serializeSolanaTransaction(transaction),
    });
    if (!result) {
      throw new Error("Wallet did not return a signed transaction");
    }
    return deserializeSolanaTransaction(transaction, result.signedTransaction);
  };

  const disconnectFeature = wallet.features["standard:disconnect"] as
    | StandardDisconnectFeature
    | undefined;

  return {
    address: account.address,
    publicKey: new PublicKey(account.address),
    walletName: wallet.name,
    signTransaction,
    signAllTransactions: (transactions) =>
      Promise.all(transactions.map((tx) => signTransaction(tx))),
    disconnect: async () => {
      await disconnectFeature?.disconnect();
    },
  };
}

export async function disconnectSolanaWallet(
  connection: SolanaWalletConnection | null,
) {
  await connection?.disconnect();
}

function isAptosWallet(wallet: AptosWallet): boolean {
  return Boolean(
    wallet.features["aptos:connect"] &&
      wallet.features["aptos:signTransaction"],
  );
}

export async function discoverAptosWallets(): Promise<AptosWallet[]> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const { aptosWallets } = getAptosWallets();
  return aptosWallets.filter(isAptosWallet);
}

export async function connectAptosWallet(
  selectedWallet?: AptosWallet,
): Promise<AptosWalletConnection> {
  const wallet = selectedWallet ?? (await discoverAptosWallets()).at(0);
  if (!wallet?.features["aptos:connect"]) {
    throw new Error(
      "No Aptos wallet detected (install Petra or another AIP-62 wallet)",
    );
  }

  const response = await wallet.features["aptos:connect"].connect();
  if (response.status !== UserResponseStatus.APPROVED) {
    throw new Error("Aptos wallet connection rejected");
  }

  const address = response.args.address.toString();
  return {
    address,
    walletName: wallet.name,
    wallet,
    disconnect: async () => {
      await wallet.features["aptos:disconnect"]?.disconnect();
    },
  };
}

export async function disconnectAptosWallet(
  connection: AptosWalletConnection | null,
) {
  await connection?.disconnect();
}

/** EIP-1193 error for a chain the wallet does not recognise yet. */
const CHAIN_NOT_ADDED = 4902;

function errorCode(error: unknown): number | undefined {
  const e = error as {
    code?: number;
    data?: { originalError?: { code?: number } };
  };
  return e?.code ?? e?.data?.originalError?.code;
}

export async function ensureEvmChain(
  provider: EvmProvider,
  chainId: SupportedChainId
) {
  const chain = CHAIN_CONFIGS[chainId].viemChain;
  if (!chain) {
    throw new Error(`Unsupported EVM chain: ${chainId}`);
  }

  const hexChainId = `0x${chainId.toString(16)}`;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }],
    });
  } catch (error: unknown) {
    // Anything other than "chain not added" is the user's answer, including a
    // 4001 rejection that the caller surfaces in the banner.
    if (errorCode(error) !== CHAIN_NOT_ADDED) {
      throw error;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hexChainId,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: chain.rpcUrls.default.http,
          blockExplorerUrls: chain.blockExplorers
            ? Object.values(chain.blockExplorers).map(({ url }) => url)
            : undefined,
        },
      ],
    });
  }

  const activeChainId = (await provider.request({ method: "eth_chainId" })) as string;
  if (parseInt(activeChainId, 16) !== chainId) {
    throw new Error(`Wallet is not on ${chain.name}. Please switch to it and retry.`);
  }
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
