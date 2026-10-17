import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./app/routes";
import { ApiProvider } from "./lib/api-context";
import { createApi } from "./lib/api";
import { emitUnauthenticated } from "./lib/auth-events";
import { queryClient } from "./lib/query-client";

const api = createApi({
  storage: localStorage,
  onUnauthenticated: emitUnauthenticated,
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider api={api}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ApiProvider>
    </QueryClientProvider>
  );
}
