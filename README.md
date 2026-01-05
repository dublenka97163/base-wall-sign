# Base Wall Sign

Official Farcaster Mini App on Base.

Users sign a shared wall by drawing on the Base logo.
Each signature is an onchain transaction (gas only) and mints an NFT achievement.

Stack:
- Next.js
- Base
- Farcaster Mini Apps

## Getting started

1. Copy `.env.example` to `.env.local` and set:
   - `NEXT_PUBLIC_CONTRACT_ADDRESS` to your deployed `BaseWallSign` contract.
   - `NEXT_PUBLIC_BASE_RPC` to a Base RPC endpoint.
   - Optionally `NEXT_PUBLIC_CHAIN_ID` (defaults to Base mainnet).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the app locally:
   ```bash
   npm run dev
   ```

## Smart contract

- Location: `contracts/BaseWallSign.sol`
- Purpose: emit a `Signed` event containing the compressed drawing and mint a simple ERC-721 NFT per signature.
- There are no admin controls or withdraw functions. The deployer has no special powers.

### Deploying

- Recommended: Remix on Base mainnet or Base Sepolia.
- Paste the contract, deploy, and copy the address.
- Provide that address to the app via `NEXT_PUBLIC_CONTRACT_ADDRESS`.

## Farcaster Mini App manifest

The app includes `public/manifest.json` configured for the Base Wall Sign mini app. Ensure the deployed URL matches the `start_url`.

## Rendering and determinism

- The wall is rebuilt from onchain `Signed` events ordered by block number and log index.
- Signature data is delta-encoded, normalized to a 4095 grid, and bounded to 4096 bytes to keep gas low.
- The Base logo is always re-applied as a reveal overlay so signatures cannot fully obscure it, both in-app and in the `/api/wall` PNG export.
