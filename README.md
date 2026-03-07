# CCTP Sample App

> **Warning:** This is a local development sample application only. It exposes private keys to the browser via `NEXT_PUBLIC_` environment variables. **Do not deploy this application to any public environment.** Use only testnet keys with no real value.

This sample application demonstrates Cross-Chain Transfer Protocol (CCTP) step-by-step capabilities on testnet networks. The app showcases CCTP functionality across multiple testnets:

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

## Getting Started

1. Clone this repository:
   ```bash
   git clone https://github.com/circlefin/circle-cctp-crosschain-transfer.git
   ```
2. Install dependencies.
   ```bash
   npm install
   ```
3. Run the development server.
   ```bash
   npm run dev
   ```

The sample app will be running at [http://localhost:3000](http://localhost:3000).

