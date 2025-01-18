"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  RainbowKitProvider,
  getDefaultConfig,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import {
  rainbowWallet,
  metaMaskWallet,
  coinbaseWallet,
  argentWallet,
  trustWallet,
  ledgerWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { avalanche, avalancheFuji } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createStorage,
  WagmiProvider,
  Config,
  createConfig,
  http,
} from "wagmi";

interface BaseStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

import { env } from "@/env";
import { siteConfig } from "@/lib/site";

export const noopStorage: BaseStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const singularEnv =
  env.NEXT_PUBLIC_ENVIRONMENT === "PRODUCTION" ? "prod" : "dev";

export const storage =
  typeof window !== "undefined" && window.localStorage
    ? createStorage({
        key: `gen-it-${singularEnv}`,
        storage: window.localStorage,
      })
    : null;

export const web3Config = createConfig({
  chains: [avalanche],
  transports: {
    [avalanche.id]: http(),
  },
  storage,
});

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    const config = getDefaultConfig({
      appName: siteConfig.name,
      projectId: env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
      wallets: [
        {
          groupName: "Most used",
          wallets: [rainbowWallet, metaMaskWallet, coinbaseWallet],
        },
        {
          groupName: "Other",
          wallets: [argentWallet, trustWallet, ledgerWallet],
        },
      ],
      chains: [avalanche, avalancheFuji],
      storage,
    });

    setConfig(config);
  }, []);

  const queryClient = new QueryClient();

  if (!config) return null;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider modalSize="compact" theme={darkTheme()}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
