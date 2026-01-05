import { createPublicClient, hexToBytes, http, type Hex } from "viem";
import { base, baseSepolia } from "viem/chains";
import { getChainId, getContractAddress, getRpcUrl } from "./env";
import { contractAbi } from "./contract";
import { Stroke, decodeSignature } from "./signatureEncoding";

export type SignatureEvent = {
  signer: `0x${string}`;
  tokenId: bigint;
  signature: Stroke[];
  transactionHash: `0x${string}`;
  logIndex: number;
  blockNumber: bigint;
};

const chain = getChainId() === base.id ? base : baseSepolia;

const client = createPublicClient({
  chain,
  transport: http(getRpcUrl()),
});

// IMPORTANT: set this to your deploy block (Base mainnet)
const DEFAULT_DEPLOY_BLOCK = 40425685n;

const getDeployBlock = () => {
  const raw = process.env.NEXT_PUBLIC_DEPLOY_BLOCK;
  if (!raw) return DEFAULT_DEPLOY_BLOCK;
  try {
    return BigInt(raw);
  } catch {
    return DEFAULT_DEPLOY_BLOCK;
  }
};

export const fetchSignatureEvents = async (
  width: number,
  height: number
): Promise<SignatureEvent[]> => {
  let logs: Awaited<ReturnType<typeof client.getLogs>> = [];

  try {
    // Typed getLogs: viem will decode args correctly
    logs = await client.getLogs({
      address: getContractAddress() as `0x${string}`,
      event: {
        type: "event",
        name: "Signed",
        inputs: contractAbi.find((x) => x.type === "event" && x.name === "Signed")!.inputs,
      },
      fromBlock: getDeployBlock(),
      toBlock: "latest",
    });
  } catch (e) {
    console.error("fetchSignatureEvents:getLogs failed", e);
    return [];
  }

  // logs are now typed with args, no parseEventLogs needed
  const deduped = new Map<string, SignatureEvent>();

  for (const log of logs) {
    const key = `${log.transactionHash}-${log.logIndex}`;
    if (deduped.has(key)) continue;

    // viem typed args
    const signatureData = (log.args as any).signatureData as Hex;
    const signer = (log.args as any).signer as `0x${string}`;
    const tokenId = (log.args as any).tokenId as bigint;

    const decoded = decodeSignature(hexToBytes(signatureData), width, height);

    deduped.set(key, {
      signer,
      tokenId,
      signature: decoded,
      transactionHash: log.transactionHash as `0x${string}`,
      logIndex: Number(log.logIndex),
      blockNumber: log.blockNumber ?? 0n,
    });
  }

  return Array.from(deduped.values()).sort((a, b) => {
    if (a.blockNumber === b.blockNumber) return a.logIndex - b.logIndex;
    return a.blockNumber > b.blockNumber ? 1 : -1;
  });
};
