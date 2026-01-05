import { createPublicClient, hexToBytes, http } from "viem";
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

export const fetchSignatureEvents = async (
  width: number,
  height: number
): Promise<SignatureEvent[]> => {
  const events = await client.getLogs({
    address: getContractAddress() as `0x${string}`,
    event: {
      type: "event",
      name: "Signed",
      inputs: contractAbi[0]?.type === "event" ? contractAbi[0].inputs : [],
    },
    fromBlock: "earliest",
    toBlock: "latest",
  });

  const deduped = new Map<string, SignatureEvent>();

  events.forEach((log) => {
    const key = `${log.transactionHash}-${log.logIndex}`;
    if (deduped.has(key)) return;

    const signatureData = log.data as `0x${string}`;
    const decoded = decodeSignature(hexToBytes(signatureData), width, height);

    deduped.set(key, {
      signer: log.args?.signer as `0x${string}`,
      tokenId: log.args?.tokenId as bigint,
      signature: decoded,
      transactionHash: log.transactionHash,
      logIndex: Number(log.logIndex),
      blockNumber: log.blockNumber,
    });
  });

  return Array.from(deduped.values()).sort((a, b) => {
    if (a.blockNumber === b.blockNumber) {
      return a.logIndex - b.logIndex;
    }
    return a.blockNumber > b.blockNumber ? 1 : -1;
  });
};
