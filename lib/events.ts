import {
  createPublicClient,
  hexToBytes,
  http,
  parseEventLogs,
  type Hex,
} from "viem";
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

const DEFAULT_DEPLOY_BLOCK = 40425685n;

const getDeployBlock = () => {
  const raw = process.env.NEXT_PUBLIC_DEPLOY_BLOCK;
  try {
    return raw ? BigInt(raw) : DEFAULT_DEPLOY_BLOCK;
  } catch {
    return DEFAULT_DEPLOY_BLOCK;
  }
};

export const fetchSignatureEvents = async (
  width: number,
  height: number
): Promise<SignatureEvent[]> => {
  let logs = [];

  try {
    logs = await client.getLogs({
      address: getContractAddress() as `0x${string}`,
      fromBlock: getDeployBlock(),
      toBlock: "latest",
    });
  } catch (e) {
    console.error("getLogs failed", e);
    return [];
  }

  const events = parseEventLogs({
    abi: contractAbi,
    logs,
    eventName: "Signed",
  });

  const deduped = new Map<string, SignatureEvent>();

  for (const log of events) {
    const key = `${log.transactionHash}-${log.logIndex}`;
    if (deduped.has(key)) continue;

    const signatureData = log.args.signatureData as Hex;
    const decoded = decodeSignature(
      hexToBytes(signatureData),
      width,
      height
    );

    deduped.set(key, {
      signer: log.args.signer,
      tokenId: log.args.tokenId,
      signature: decoded,
      transactionHash: log.transactionHash,
      logIndex: Number(log.logIndex),
      blockNumber: log.blockNumber,
    });
  }

  return Array.from(deduped.values()).sort((a, b) => {
    if (a.blockNumber === b.blockNumber) {
      return a.logIndex - b.logIndex;
    }
    return a.blockNumber > b.blockNumber ? 1 : -1;
  });
};
