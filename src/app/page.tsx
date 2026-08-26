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

import { useEffect, useState } from "react";
import { useCrossChainTransfer } from "@/hooks/use-cross-chain-transfer";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  SupportedChainId,
  SUPPORTED_CHAINS,
  CHAIN_CONFIGS,
} from "@/lib/chains";
import { ProgressSteps } from "@/components/progress-step";
import { TransferLog } from "@/components/transfer-log";
import { Timer } from "@/components/timer";
import { TransferTypeSelector } from "@/components/transfer-type";
import {
  connectEvmWallet,
  connectSolanaWallet,
  discoverEvmWallets,
  discoverSolanaWallets,
  disconnectSolanaWallet,
  type EvmProviderOption,
  type WalletConnections,
} from "@/lib/browser-wallets";
import type { Wallet } from "@wallet-standard/core";

export default function Home() {
  const { currentStep, logs, error, executeTransfer, getBalance, reset } =
    useCrossChainTransfer();
  const [sourceChain, setSourceChain] = useState<SupportedChainId>(
    SupportedChainId.ARC_TESTNET,
  );
  const [destinationChain, setDestinationChain] = useState<SupportedChainId>(
    SupportedChainId.ETH_SEPOLIA,
  );
  const [amount, setAmount] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTransferring, setIsTransferring] = useState(false);
  const [showFinalTime, setShowFinalTime] = useState(false);
  const [transferType, setTransferType] = useState<"fast" | "standard">("fast");
  const [balance, setBalance] = useState("0");
  const [wallets, setWallets] = useState<WalletConnections>({
    evm: null,
    solana: null,
    aptos: null,
    stellar: null,
  });
  const [evmWalletOptions, setEvmWalletOptions] = useState<EvmProviderOption[]>(
    [],
  );
  const [showEvmWalletPicker, setShowEvmWalletPicker] = useState(false);
  const [solanaWalletOptions, setSolanaWalletOptions] = useState<Wallet[]>([]);
  const [showSolanaWalletPicker, setShowSolanaWalletPicker] = useState(false);

  const sourceEcosystem = CHAIN_CONFIGS[sourceChain].ecosystem;
  const destinationEcosystem = CHAIN_CONFIGS[destinationChain].ecosystem;
  const needsEvmWallet =
    sourceEcosystem === "evm" || destinationEcosystem === "evm";
  const needsSolanaWallet =
    sourceEcosystem === "solana" || destinationEcosystem === "solana";
  const missingRequiredWallet =
    (needsEvmWallet && !wallets.evm) || (needsSolanaWallet && !wallets.solana);

  const handleStartTransfer = async () => {
    setIsTransferring(true);
    setShowFinalTime(false);
    setElapsedSeconds(0);
    try {
      reset();
      await executeTransfer(
        sourceChain,
        destinationChain,
        amount,
        transferType,
        wallets,
      );
    } catch (error) {
      console.error("Transfer failed:", error);
    } finally {
      setIsTransferring(false);
      setShowFinalTime(true);
    }
  };

  const handleReset = () => {
    reset();
    setIsTransferring(false);
    setShowFinalTime(false);
    setElapsedSeconds(0);
  };

  const handleEvmWalletClick = async () => {
    if (wallets.evm) {
      setWallets((current) => ({ ...current, evm: null }));
      return;
    }

    try {
      const options = await discoverEvmWallets();
      if (options.length > 1) {
        setEvmWalletOptions(options);
        setShowEvmWalletPicker(true);
        return;
      }

      const connection = await connectEvmWallet(options[0]);
      setWallets((current) => ({ ...current, evm: connection }));
    } catch (error) {
      console.error("Failed to connect EVM wallet:", error);
    }
  };

  const handleEvmWalletSelect = async (provider: EvmProviderOption) => {
    try {
      const connection = await connectEvmWallet(provider);
      setWallets((current) => ({ ...current, evm: connection }));
      setShowEvmWalletPicker(false);
    } catch (error) {
      console.error("Failed to connect selected EVM wallet:", error);
    }
  };

  const handleSolanaWalletClick = async () => {
    if (wallets.solana) {
      try {
        await disconnectSolanaWallet(wallets.solana);
      } catch (error) {
        console.error("Failed to disconnect Solana wallet:", error);
      }
      setWallets((current) => ({ ...current, solana: null }));
      return;
    }

    try {
      const options = await discoverSolanaWallets();
      if (options.length > 1) {
        setSolanaWalletOptions(options);
        setShowSolanaWalletPicker(true);
        return;
      }

      const connection = await connectSolanaWallet(options[0]);
      setWallets((current) => ({ ...current, solana: connection }));
    } catch (error) {
      console.error("Failed to connect Solana wallet:", error);
    }
  };

  const handleSolanaWalletSelect = async (wallet: Wallet) => {
    try {
      const connection = await connectSolanaWallet(wallet);
      setWallets((current) => ({ ...current, solana: connection }));
      setShowSolanaWalletPicker(false);
    } catch (error) {
      console.error("Failed to connect selected Solana wallet:", error);
    }
  };

  useEffect(() => {
    const wrapper = async () => {
      try {
        const balance = await getBalance(sourceChain, wallets);
        setBalance(balance);
      } catch (error) {
        console.error("Failed to get balance:", error);
        setBalance("0");
      }
    };
    wrapper();
  }, [sourceChain, wallets, getBalance]);

  const formatAddress = (address: string | null) => {
    if (!address) {
      return null;
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-center">
            Crosschain USDC Transfer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-3">
            <div className="text-center">
              <Button variant="outline" onClick={handleEvmWalletClick}>
                {wallets.evm ? "Disconnect EVM Wallet" : "Connect EVM Wallet"}
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                {wallets.evm
                  ? `${formatAddress(wallets.evm.address)}${
                      wallets.evm.providerInfo?.name
                        ? ` (${wallets.evm.providerInfo.name})`
                        : ""
                    }`
                  : "Required for EVM source or destination chains"}
              </p>
              {showEvmWalletPicker && (
                <div className="mt-3 space-y-2 rounded-lg border bg-white p-3 text-left">
                  <p className="text-sm font-medium">Choose EVM wallet</p>
                  <div className="flex gap-3 flex-wrap">
                    {evmWalletOptions.map((option) => (
                      <Button
                        key={option.info.uuid}
                        variant="outline"
                        onClick={() => handleEvmWalletSelect(option)}
                      >
                        {option.info.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="text-center">
              <Button variant="outline" onClick={handleSolanaWalletClick}>
                {wallets.solana
                  ? "Disconnect Solana Wallet"
                  : "Connect Solana Wallet"}
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                {wallets.solana
                  ? `${formatAddress(wallets.solana.address)} (${wallets.solana.walletName})`
                  : "Required for Solana source or destination chains"}
              </p>
              {showSolanaWalletPicker && (
                <div className="mt-3 space-y-2 rounded-lg border bg-white p-3 text-left">
                  <p className="text-sm font-medium">Choose Solana wallet</p>
                  <div className="flex gap-3 flex-wrap">
                    {solanaWalletOptions.map((wallet) => (
                      <Button
                        key={wallet.name}
                        variant="outline"
                        onClick={() => handleSolanaWalletSelect(wallet)}
                      >
                        {wallet.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <p className="text-sm text-center">
              Make sure your wallet can complete the transfer on the destination
              chain.
            </p>
          <div className="space-y-2">
            <Label>Transfer Type</Label>
            <TransferTypeSelector
              value={transferType}
              onChange={setTransferType}
            />
            <p className="text-sm text-muted-foreground">
              {transferType === "fast"
                ? "Faster transfers with lower finality threshold (1000 blocks)"
                : "Standard transfers with higher finality (2000 blocks)"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Source Chain</Label>
              <Select
                value={String(sourceChain)}
                onValueChange={(value) => setSourceChain(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source chain" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CHAINS.map((chainId) => (
                    <SelectItem key={chainId} value={String(chainId)}>
                      {CHAIN_CONFIGS[chainId].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Destination Chain</Label>
              <Select
                value={String(destinationChain)}
                onValueChange={(value) => setDestinationChain(Number(value))}
                disabled={!sourceChain}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select destination chain" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CHAINS.filter(
                    (chainId) => chainId !== sourceChain,
                  ).map((chainId) => (
                    <SelectItem key={chainId} value={String(chainId)}>
                      {CHAIN_CONFIGS[chainId].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Amount (USDC)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              min="0"
              max={parseFloat(balance)}
              step="any"
            />
            <p className="text-sm text-muted-foreground">{balance} available</p>
          </div>

          <div className="text-center">
            {showFinalTime ? (
              <div className="text-2xl font-mono">
                <span>
                  {Math.floor(elapsedSeconds / 60)
                    .toString()
                    .padStart(2, "0")}
                </span>
                :
                <span>{(elapsedSeconds % 60).toString().padStart(2, "0")}</span>
              </div>
            ) : (
              <Timer isRunning={isTransferring} onTick={setElapsedSeconds} />
            )}
          </div>

          <ProgressSteps currentStep={currentStep} />

          <TransferLog logs={logs} />
          {error && <div className="text-red-500 text-center">{error}</div>}
          <div className="flex justify-center gap-4">
            <Button
              onClick={handleStartTransfer}
              disabled={
                isTransferring ||
                currentStep === "completed" ||
                !amount ||
                parseFloat(amount) <= 0 ||
                missingRequiredWallet
              }
            >
              {currentStep === "completed"
                ? "Transfer Complete"
                : "Start Transfer"}
            </Button>
            {(currentStep === "completed" || currentStep === "error") && (
              <Button variant="outline" onClick={handleReset}>
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
