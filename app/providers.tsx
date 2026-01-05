"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiConfig, createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { ReactNode, useMemo } from "react";
import { getChainId, getRpcUrl } from "@/lib/env";

const chain = getChainId() === base.id ? base : baseSepolia;

const config = createConfig({
  chains: [chain],
  transports: {
    [chain.id]: http(getRpcUrl()),
  },
  connectors: [injected({ target: "metaMask" }), injected({ target: "walletConnect" }), injected()],
});

export function Providers({ children }: { children: ReactNode }) {
  const client = useMemo(() => new QueryClient(), []);
  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </WagmiConfig>
  );
}
