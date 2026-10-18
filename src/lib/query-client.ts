import { QueryClient } from "@tanstack/react-query";
import { pollRetryDelay, shouldRetry } from "./resilience";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "offlineFirst",
      staleTime: 5_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: shouldRetry,
      retryDelay: pollRetryDelay,
    },
    mutations: { networkMode: "online", retry: false },
  },
});
