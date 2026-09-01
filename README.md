# Circle CCTP Crosschain Transfer Sample App

This sample app demonstrates how to use Circle's [Cross-Chain Transfer Protocol (CCTP)](https://developers.circle.com/stablecoins/cctp-getting-started) to transfer USDC across chains. It walks through the CCTP flow — approve on EVM source chains, burn, attest through Circle's IRIS sandbox API, and mint — across EVM, Solana, and Aptos testnets using a Next.js interface.

> **Note:** This demo uses injected user wallets for signing. Use testnet wallets only and do not treat this sample as production-ready custody or wallet infrastructure.

## Prerequisites

- Node.js 22+
- An injected EVM wallet such as MetaMask
- An injected Solana wallet such as Phantom
- An AIP-62 Aptos wallet such as Petra
- Testnet USDC on the relevant chains and native tokens for gas fees

## Getting Started

1. Clone this repository:

   ```bash
   git clone https://github.com/circlefin/circle-cctp-crosschain-transfer.git
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the app in development:

   ```bash
   npm run dev
   ```

The app will be running at `http://localhost:3000`.

## How It Works

- Built with [Next.js](https://nextjs.org/) (App Router). EVM uses [viem](https://viem.sh/); Solana uses [@coral-xyz/anchor](https://www.anchor-lang.com/) + [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/); Aptos uses [@aptos-labs/ts-sdk](https://aptos.dev/build/sdks/ts-sdk) and precompiled Move scripts.
- Wallet discovery/connect for EVM, Solana, and Aptos lives in `browser-wallets.ts`. The UI connects whichever wallets the selected source/destination ecosystems require.
- Core transfer logic is in `use-cross-chain-transfer.ts`: approve (EVM only) → burn → IRIS attestation → mint. Solana and Aptos sources skip a separate approval transaction.
- Chain config (ecosystem, contract/module addresses, destination domains, viem chains, Aptos script URLs) is centralized in `CHAIN_CONFIGS` in `chains.ts`.

## Supported Chains

- Aptos Testnet
- Arbitrum Sepolia
- Arc Testnet
- Avalanche Fuji
- Base Sepolia
- Codex Testnet
- Cronos Testnet
- Edge Testnet
- Ethereum Sepolia
- HyperEvm Testnet
- Injective Testnet
- Ink Sepolia
- Linea Sepolia
- Monad Testnet
- Morph Hoodi
- Optimism Sepolia
- Pharos Atlantic
- Plasma Testnet
- Plume Sepolia
- Polygon Amoy
- Sei Testnet
- Solana Devnet
- Sonic Testnet
- Unichain Sepolia
- Worldchain Sepolia
- XDC Testnet
- XLayer Testnet

## File Highlights

- `src/hooks/use-cross-chain-transfer.ts`: Core CCTP transfer hook (approve, burn, attest, mint) across ecosystems
- `src/lib/chains.ts`: Centralized chain configuration, ecosystems, and contract/module addresses
- `src/lib/browser-wallets.ts`: Injected wallet discovery and connect/disconnect for EVM, Solana, and Aptos
- `src/lib/solana-utils.ts`: Solana Anchor setup, PDA derivation, nonce decoding
- `src/lib/aptos-utils.ts`: Aptos client, Move script submit helpers, USDC balance reads
- `public/aptos/precompiled-move-scripts/`: Precompiled Aptos V2 Move scripts (`deposit_for_burn.mv`, `receive_message.mv`); see that folder’s README for refresh instructions from [aptos-cctp](https://github.com/circlefin/aptos-cctp)
- `src/app/page.tsx`: Main UI for wallets, chains, amount, transfer type, and progress
- `src/components/timer.tsx`, `progress-step.tsx`, `transfer-log.tsx`, `transfer-type.tsx`: Transfer UI helpers

## Usage Notes

- This sample is scoped to testnets only.
- Connect an EVM wallet for EVM source or destination chains.
- Connect a Solana wallet for Solana source or destination chains.
- Connect an Aptos wallet for Aptos source or destination chains.
- Aptos burns/mints submit precompiled Move scripts from `public/aptos/precompiled-move-scripts/`.
- Attestation polling can take several minutes depending on source chain finality.

## Scripts

- `npm run dev`: Start the Next.js development server
- `npm run build`: Build the production application
- `npm run start`: Start the production server
- `npm run lint`: Run ESLint

## Security & Usage Model

This sample application:
- Assumes testnet or sandbox usage only
- Relies on injected browser wallets for signing
- Is not intended for production use without modification

See `SECURITY.md` for vulnerability reporting guidelines. Please report vulnerabilities privately through Circle's [Vulnerability Disclosure Program](https://hackerone.com/circle).

## License

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE.txt)
