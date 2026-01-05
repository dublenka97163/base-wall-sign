const requiredEnv = (name: string, fallback?: string) => {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
};

export const getContractAddress = () =>
  requiredEnv("NEXT_PUBLIC_CONTRACT_ADDRESS");

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
