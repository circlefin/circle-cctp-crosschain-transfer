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

"use client";

import { useState } from "react";
import type { AptosWallet } from "@aptos-labs/wallet-standard";
import type { Wallet } from "@wallet-standard/core";

import { Button } from "@/components/ui/button";
import type { Ecosystem } from "@/lib/chains";
import {
  connectAptosWallet,
  connectEvmWallet,
  connectSolanaWallet,
  connectSuiWallet,
  discoverAptosWallets,
  discoverEvmWallets,
  discoverSolanaWallets,
  discoverSuiWallets,
  disconnectAptosWallet,
  disconnectSolanaWallet,
  disconnectSuiWallet,
  type AptosWalletConnection,
  type EvmProviderOption,
  type EvmWalletConnection,
  type SolanaWalletConnection,
  type SuiWalletConnection,
  type WalletConnections,
} from "@/lib/browser-wallets";

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function WalletConnectorSlot<TOption>({
  ecosystem,
  address,
  walletName,
  options,
  showPicker,
  optionKey,
  optionLabel,
  onConnect,
  onDisconnect,
  onSelect,
}: {
  ecosystem: string;
  address: string | null;
  walletName?: string | null;
  options: TOption[];
  showPicker: boolean;
  optionKey: (option: TOption) => string;
  optionLabel: (option: TOption) => string;
  onConnect: () => void;
  onDisconnect: () => void;
  onSelect: (option: TOption) => void;
}) {
  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        className="w-full"
        onClick={address ? onDisconnect : onConnect}
      >
        {address ? `Disconnect ${ecosystem}` : `Connect ${ecosystem}`}
      </Button>
      {address ? (
        <p
          className="text-sm text-muted-foreground truncate"
          title={walletName ? `${address} · ${walletName}` : address}
        >
          {formatAddress(address)}
          {walletName ? ` · ${walletName}` : ""}
        </p>
      ) : null}
      {showPicker && (
        <div className="space-y-2 rounded-lg border bg-white p-3">
          <p className="text-sm font-medium">Choose {ecosystem} wallet</p>
          <div className="flex gap-3 flex-wrap">
            {options.map((option) => (
              <Button
                key={optionKey(option)}
                variant="outline"
                onClick={() => onSelect(option)}
              >
                {optionLabel(option)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EvmWalletConnector({
  connection,
  onChange,
}: {
  connection: EvmWalletConnection | null;
  onChange: (connection: EvmWalletConnection | null) => void;
}) {
  const [options, setOptions] = useState<EvmProviderOption[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const handleConnect = async () => {
    try {
      const discovered = await discoverEvmWallets();
      if (discovered.length > 1) {
        setOptions(discovered);
        setShowPicker(true);
        return;
      }
      onChange(await connectEvmWallet(discovered[0]));
    } catch (error) {
      console.error("Failed to connect EVM wallet:", error);
    }
  };

  const handleDisconnect = () => {
    onChange(null);
    setShowPicker(false);
  };

  const handleSelect = async (option: EvmProviderOption) => {
    try {
      onChange(await connectEvmWallet(option));
      setShowPicker(false);
    } catch (error) {
      console.error("Failed to connect selected EVM wallet:", error);
    }
  };

  return (
    <WalletConnectorSlot
      ecosystem="EVM"
      address={connection?.address ?? null}
      walletName={connection?.providerInfo?.name}
      options={options}
      showPicker={showPicker}
      optionKey={(option) => option.info.uuid}
      optionLabel={(option) => option.info.name}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
      onSelect={handleSelect}
    />
  );
}

function SolanaWalletConnector({
  connection,
  onChange,
}: {
  connection: SolanaWalletConnection | null;
  onChange: (connection: SolanaWalletConnection | null) => void;
}) {
  const [options, setOptions] = useState<Wallet[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const handleConnect = async () => {
    try {
      const discovered = await discoverSolanaWallets();
      if (discovered.length > 1) {
        setOptions(discovered);
        setShowPicker(true);
        return;
      }
      onChange(await connectSolanaWallet(discovered[0]));
    } catch (error) {
      console.error("Failed to connect Solana wallet:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectSolanaWallet(connection);
    } catch (error) {
      console.error("Failed to disconnect Solana wallet:", error);
    }
    onChange(null);
    setShowPicker(false);
  };

  const handleSelect = async (wallet: Wallet) => {
    try {
      onChange(await connectSolanaWallet(wallet));
      setShowPicker(false);
    } catch (error) {
      console.error("Failed to connect selected Solana wallet:", error);
    }
  };

  return (
    <WalletConnectorSlot
      ecosystem="Solana"
      address={connection?.address ?? null}
      walletName={connection?.walletName}
      options={options}
      showPicker={showPicker}
      optionKey={(wallet) => wallet.name}
      optionLabel={(wallet) => wallet.name}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
      onSelect={handleSelect}
    />
  );
}

function AptosWalletConnector({
  connection,
  onChange,
}: {
  connection: AptosWalletConnection | null;
  onChange: (connection: AptosWalletConnection | null) => void;
}) {
  const [options, setOptions] = useState<AptosWallet[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const handleConnect = async () => {
    try {
      const discovered = await discoverAptosWallets();
      if (discovered.length > 1) {
        setOptions(discovered);
        setShowPicker(true);
        return;
      }
      onChange(await connectAptosWallet(discovered[0]));
    } catch (error) {
      console.error("Failed to connect Aptos wallet:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectAptosWallet(connection);
    } catch (error) {
      console.error("Failed to disconnect Aptos wallet:", error);
    }
    onChange(null);
    setShowPicker(false);
  };

  const handleSelect = async (wallet: AptosWallet) => {
    try {
      onChange(await connectAptosWallet(wallet));
      setShowPicker(false);
    } catch (error) {
      console.error("Failed to connect selected Aptos wallet:", error);
    }
  };

  return (
    <WalletConnectorSlot
      ecosystem="Aptos"
      address={connection?.address ?? null}
      walletName={connection?.walletName}
      options={options}
      showPicker={showPicker}
      optionKey={(wallet) => wallet.name}
      optionLabel={(wallet) => wallet.name}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
      onSelect={handleSelect}
    />
  );
}

function SuiWalletConnector({
  connection,
  onChange,
}: {
  connection: SuiWalletConnection | null;
  onChange: (connection: SuiWalletConnection | null) => void;
}) {
  const [options, setOptions] = useState<Wallet[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const handleConnect = async () => {
    try {
      const discovered = await discoverSuiWallets();
      if (discovered.length > 1) {
        setOptions(discovered);
        setShowPicker(true);
        return;
      }
      onChange(await connectSuiWallet(discovered[0]));
    } catch (error) {
      console.error("Failed to connect Sui wallet:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectSuiWallet(connection);
    } catch (error) {
      console.error("Failed to disconnect Sui wallet:", error);
    }
    onChange(null);
    setShowPicker(false);
  };

  const handleSelect = async (wallet: Wallet) => {
    try {
      onChange(await connectSuiWallet(wallet));
      setShowPicker(false);
    } catch (error) {
      console.error("Failed to connect selected Sui wallet:", error);
    }
  };

  return (
    <WalletConnectorSlot
      ecosystem="Sui"
      address={connection?.address ?? null}
      walletName={connection?.walletName}
      options={options}
      showPicker={showPicker}
      optionKey={(wallet) => wallet.name}
      optionLabel={(wallet) => wallet.name}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
      onSelect={handleSelect}
    />
  );
}

/** True when a required ecosystem for the route has no connected wallet. */
export function isMissingRequiredWallet(
  wallets: WalletConnections,
  sourceEcosystem: Ecosystem,
  destinationEcosystem: Ecosystem,
): boolean {
  const required = new Set<Ecosystem>([sourceEcosystem, destinationEcosystem]);
  return (
    (required.has("evm") && !wallets.evm) ||
    (required.has("solana") && !wallets.solana) ||
    (required.has("aptos") && !wallets.aptos) ||
    (required.has("sui") && !wallets.sui) ||
    (required.has("stellar") && !wallets.stellar)
  );
}

export function WalletConnectors({
  wallets,
  onWalletsChange,
}: {
  wallets: WalletConnections;
  onWalletsChange: (
    update: (current: WalletConnections) => WalletConnections,
  ) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <EvmWalletConnector
          connection={wallets.evm}
          onChange={(evm) =>
            onWalletsChange((current) => ({ ...current, evm }))
          }
        />
        <SolanaWalletConnector
          connection={wallets.solana}
          onChange={(solana) =>
            onWalletsChange((current) => ({ ...current, solana }))
          }
        />
        <SuiWalletConnector
          connection={wallets.sui}
          onChange={(sui) =>
            onWalletsChange((current) => ({ ...current, sui }))
          }
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Connect the wallets your source and destination require, ensure the
        destination wallet can receive the mint.
      </p>
    </div>
  );
}
