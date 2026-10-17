import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "offlineFirst",
      staleTime: 5_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 404 || error.status === 400)) {
          return false;
        }
        return failureCount < 1;
      },
    },
    mutations: { networkMode: "online", retry: false },
  },
});
