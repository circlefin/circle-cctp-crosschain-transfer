# Circle CCTP Crosschain Transfer Sample App

This sample app demonstrates how to use Circle's [Cross-Chain Transfer Protocol (CCTP)](https://developers.circle.com/stablecoins/cctp-getting-started) to transfer USDC across chains. It walks through the full CCTP flow — approve, burn, attest, and mint — on both EVM and Solana testnets using a Next.js interface.

> **Warning:** This app exposes private keys to the browser via `NEXT_PUBLIC_` environment variables. Use only testnet keys with no real value. Do not deploy to any public environment.

## Prerequisites

- Node.js 20+ and npm
- An EVM private key (32-byte hex string) for EVM chain transfers
- A Solana private key (Base58 encoded) for Solana Devnet transfers
- Testnet USDC on the relevant chains and native tokens for gas fees

## Getting Started

1. Clone this repository:

   ```bash
   git clone https://github.com/circlefin/circle-cctp-crosschain-transfer.git
   ```

2. Create a `.env.local` file in the project root:

   ```bash
   cp .env.example .env.local
   ```

   Minimum variables:

   ```bash
   NEXT_PUBLIC_EVM_PRIVATE_KEY=your_evm_private_key_here
   NEXT_PUBLIC_SOLANA_PRIVATE_KEY=your_solana_private_key_here
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the app in development:

   ```bash
   npm run dev
   ```

The app will be running at `http://localhost:3000`.

## How It Works

- The app is built with [Next.js](https://nextjs.org/) (App Router) and uses [viem](https://viem.sh/) for EVM interactions and [@coral-xyz/anchor](https://www.anchor-lang.com/) + [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/) for Solana interactions.
- The core transfer logic lives in a single React hook (`use-cross-chain-transfer.ts`) that orchestrates the four CCTP steps: approve spending, burn USDC on the source chain, retrieve attestation from Circle's IRIS API, and mint USDC on the destination chain.
- Chain configuration (contract addresses, destination domains, viem chain definitions) is centralized in a single `CHAIN_CONFIGS` record in `chains.ts`.
- The app automatically selects the correct private key and client type (EVM or Solana) based on the chosen source and destination chains.

## Supported Chains

- Arbitrum Sepolia
- Arc Testnet
- Avalanche Fuji C-Chain
- Base Sepolia
- Codex Testnet
- Edge Testnet
- Ethereum Sepolia
- HyperEVM Testnet
- Ink Sepolia
- Linea Sepolia
- Monad Testnet
- Optimism Sepolia
- Plume Sepolia
- Polygon PoS Amoy
- Sei Testnet
- Solana Devnet
- Sonic Testnet
- Unichain Sepolia
- Worldchain Sepolia
- XDC Testnet

## File Highlights

- `src/hooks/use-cross-chain-transfer.ts`: Core CCTP transfer hook (approve, burn, attest, mint)
- `src/lib/chains.ts`: Centralized chain configuration and contract addresses
- `src/lib/solana-utils.ts`: Solana-specific utilities (Anchor setup, PDA derivation, nonce decoding)
- `src/app/page.tsx`: Main UI for selecting chains, entering amounts, and viewing transfer progress
- `src/components/timer.tsx`: Transfer duration timer

## Usage Notes

- This sample is scoped to testnets only.
- The app uses `NEXT_PUBLIC_EVM_PRIVATE_KEY` for EVM chains and `NEXT_PUBLIC_SOLANA_PRIVATE_KEY` for Solana. The correct key is selected automatically based on the source/destination chain.
- Attestation polling can take several minutes depending on source chain finality.

## Scripts

- `npm run dev`: Start the Next.js development server
- `npm run build`: Build the production application
- `npm run start`: Start the production server
- `npm run lint`: Run ESLint

## Security & Usage Model

This sample application:
- Assumes testnet or sandbox usage only
- Exposes private keys to the browser (`NEXT_PUBLIC_` prefix) — use only testnet keys
- Is not intended for production use without modification

See `SECURITY.md` for vulnerability reporting guidelines. Please report issues privately via Circle's bug bounty program.

## License

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE.txt)
