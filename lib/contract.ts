export const BASE_LOGO_ASSET_PATH = "/assets/base-logo.svg";

export const BASE_CHAIN_ID = 8453;
export const BASE_SEPOLIA_CHAIN_ID = 84532;

export const contractAbi = [
  {
    type: "event",
    name: "Signed",
    inputs: [
      { name: "signer", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "signatureData", type: "bytes", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "function",
    name: "sign",
    stateMutability: "nonpayable",
    inputs: [{ name: "signatureData", type: "bytes" }],
    outputs: [],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "pure",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "nextTokenId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
 ] as const;
