# CCTP Sample App

This sample application demonstrates Cross-Chain Transfer Protocol (CCTP) step-by-step capabilities on testnet networks. The app showcases CCTP functionality across multiple testnets:
- Ethereum Sepolia
- Avalanche Fuji C-Chain
- Base Sepolia
- Linea Sepolia
- Arbitrum Sepolia
- Sonic Blaze
- Worldchain Sepolia
- Optimism Sepolia
- Solana Devnet
- Codex Testnet
- Unichain Sepolia
- Polygon PoS Amoy
- Sei Testnet

## Environment Setup

1. Copy the `.env.example` file to `.env.local`:
```bash
cp .env.example .env.local
```

2. Update the `.env.local` file with your configuration:
   - **EVM Private Key**: Add your EVM private key (32-byte hex string, with or without 0x prefix) to `NEXT_PUBLIC_EVM_PRIVATE_KEY`
   - **Solana Private Key**: Add your Solana private key (Base58 encoded string) to `NEXT_PUBLIC_SOLANA_PRIVATE_KEY`

   The application will automatically use the appropriate private key based on the source/destination chain:
   - **EVM chains**: Uses `NEXT_PUBLIC_EVM_PRIVATE_KEY`
   - **Solana chains**: Uses `NEXT_PUBLIC_SOLANA_PRIVATE_KEY`

   **Note**: For backward compatibility, `NEXT_PUBLIC_PRIVATE_KEY` is still supported for EVM chains if `NEXT_PUBLIC_EVM_PRIVATE_KEY` is not set.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

The sample app will be running at [http://localhost:3000](http://localhost:3000).