"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useMemo } from "react";
import { WagmiProvider } from "wagmi";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { base, baseSepolia } from "wagmi/chains";
import { wagmiConfig } from "@/lib/wagmi"; // ← путь к твоему файлу
import { getChainId } from "@/lib/env"; // ← твоя функция для chainId

const chainId = getChainId();
const chain = chainId === base.id ? base : baseSepolia;

export function Providers({ children }: { children: ReactNode }) {
  const client = useMemo(() => new QueryClient(), []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={client}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY} // ← опционально, можно без (удали проп если нет)
          chain={chain}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}