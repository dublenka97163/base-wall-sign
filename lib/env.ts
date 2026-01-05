const DEFAULT_CONTRACT = "0x4592A83E576E1031e9F53a321f6BD0ea28Bc0aF5";

const requiredEnv = (name: string, fallback?: string) => {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
};

export const getContractAddress = () =>
  requiredEnv("NEXT_PUBLIC_CONTRACT_ADDRESS", DEFAULT_CONTRACT);

export const getRpcUrl = () =>
  requiredEnv(
    "NEXT_PUBLIC_BASE_RPC",
    "https://mainnet.base.org"
  );

export const getChainId = () => {
  const raw = process.env.NEXT_PUBLIC_CHAIN_ID;
  return raw ? Number(raw) : 8453;
};

export const isPreviewMode = () =>
  process.env.NEXT_PUBLIC_PREVIEW_MODE === "true";
