# Circle CCTP Crosschain Transfer Sample App

This sample app demonstrates how to use Circle's [Cross-Chain Transfer Protocol (CCTP)](https://developers.circle.com/stablecoins/cctp-getting-started) to transfer USDC across chains. It walks through the CCTP flow — approve on EVM source chains, burn, attest through Circle's IRIS sandbox API, and mint — on EVM, Solana, and Sui testnets using a Next.js interface.

> **Note:** This demo now uses injected user wallets for signing. Use testnet wallets only and do not treat this sample as production-ready custody or wallet infrastructure.

## Prerequisites

- Node.js 22+
- An injected EVM wallet such as MetaMask
- An injected Solana wallet such as Phantom
- An injected Sui wallet such as Slush
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

- The app is built with [Next.js](https://nextjs.org/) (App Router) and uses [viem](https://viem.sh/) for EVM, [@solana/web3.js](https://www.npmjs.com/package/@solana/web3.js) for Solana, Aptos Move scripts, and [@mysten/sui](https://www.npmjs.com/package/@mysten/sui) PTBs for Sui CCTP V2.
- The core transfer logic lives in a single React hook (`use-cross-chain-transfer.ts`) that orchestrates the four CCTP steps: approve spending on EVM source chains, burn USDC on the source chain, retrieve an attestation from Circle's IRIS sandbox API, and mint USDC on the destination chain. Solana, Aptos, and Sui transfers do not require a separate approval transaction.
- Chain configuration (contract addresses, destination domains, viem chain definitions) is centralized in a single `CHAIN_CONFIGS` record in `chains.ts`.
- The app uses the connected EVM, Solana, Aptos, and/or Sui wallet based on the selected source and destination chains.

## Supported Chains

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
- Sui Testnet
- Unichain Sepolia
- Worldchain Sepolia
- XDC Testnet
- XLayer Testnet

> **Aptos (temporary):** Aptos Testnet is hidden from the browser UI because AIP-62 wallet script signing (e.g. Petra) currently fails with a `deserialize` error. Config, Move helpers, and `npm run recover-mint:aptos` still work. Re-enable by restoring Aptos in `SUPPORTED_CHAINS` and the Aptos wallet connector.

## File Highlights

- `src/hooks/use-cross-chain-transfer.ts`: Core CCTP transfer hook (approve, burn, attest, mint)
- `src/lib/chains.ts`: Centralized chain configuration and contract addresses
- `src/lib/solana-utils.ts`: Solana CCTP helpers (PDA derivation, `depositForBurn` / `receiveMessage` instructions, send helper)
- `src/lib/aptos-utils.ts`: Aptos CCTP helpers (precompiled Move scripts)
- `src/lib/sui-utils.ts`: Sui CCTP V2 helpers (deposit/receive PTBs)
- `src/app/page.tsx`: Main UI for selecting chains, entering amounts, and viewing transfer progress
- `src/components/timer.tsx`: Transfer duration timer

## Scripts

- `npm run dev`: Start the Next.js development server
- `npm run build`: Build the production application
- `npm run start`: Start the production server
- `npm run lint`: Run ESLint

## Usage Notes

- This sample is scoped to testnets only.
- Connect an EVM wallet for EVM source or destination chains.
- Connect a Solana wallet for Solana source or destination chains.
- Connect a Sui wallet for Sui source or destination chains. Sui burns expect SIP-58 address-balance USDC (see Circle's [Sui ↔ Arc quickstart](https://developers.circle.com/cctp/quickstarts/transfer-usdc-sui-arc)).
- Attestation polling can take several minutes depending on source chain finality.

## Troubleshooting

- **Public RPC CORS:** EVM balance reads use viem's browser `http()` transport against each chain's default public RPC. Some testnet RPCs (for example Morph Hoodi at `https://rpc-hoodi.morph.network`) do not send `Access-Control-Allow-Origin` for `http://localhost:3000`, so the browser blocks the request. You may see `Failed to fetch` / `ContractFunctionExecutionError` in the console and a `0` balance even when the wallet and USDC contract are fine. `curl` to the same RPC can still succeed because it is not subject to CORS. This is an RPC operator configuration issue, not something the sample app can fix from the client. Workarounds: use a CORS-enabled RPC URL for that chain, proxy RPC calls through your own backend, or rely on the wallet provider for reads.

### Recover mint (stuck after burn + attestation)

If a transfer burned and Iris has an attestation but the destination mint failed, recover with the source domain and burn transaction hash. Put keys in `.env` (copy from `.env.example`) — do not pass private keys on the command line.

```bash
cp .env.example .env   # then edit .env

npm run recover-mint:evm -- <sourceDomain> <burnTxHash>      # needs EVM_PRIVATE_KEY, DEST_CHAIN_ID
npm run recover-mint:solana -- <sourceDomain> <burnTxHash>   # needs SOLANA_PRIVATE_KEY
npm run recover-mint:aptos -- <sourceDomain> <burnTxHash>    # needs APTOS_PRIVATE_KEY
npm run recover-mint:sui -- <sourceDomain> <burnTxHash>      # needs SUI_PRIVATE_KEY
```

Each script loads `.env` via Node `--env-file`, polls Iris sandbox for the attestation, then submits `receiveMessage` / mint on that ecosystem.

## Security & Usage Model

This sample application:
- Assumes testnet or sandbox usage only
- Relies on injected browser wallets for signing
- Is not intended for production use without modification

See `SECURITY.md` for vulnerability reporting guidelines. Please report vulnerabilities privately through Circle's [Vulnerability Disclosure Program](https://hackerone.com/circle).

## License

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE.txt)
