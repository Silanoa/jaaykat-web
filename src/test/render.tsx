import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "../app/routes";
import { ApiProvider } from "../lib/api-context";
import { createApi } from "../lib/api";
import { emitUnauthenticated } from "../lib/auth-events";
import { writeStoredSession } from "../lib/session";
import { useSession } from "../stores/session";

export function renderAt(path: string, fetchImpl: typeof fetch, authenticated = false) {
  localStorage.clear();
  if (authenticated) {
    writeStoredSession(localStorage, { token: "tok", expiresAt: "2099-01-01T00:00:00.000Z" });
  }
  useSession.getState().hydrate();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const api = createApi({ storage: localStorage, fetch: fetchImpl, onUnauthenticated: emitUnauthenticated });
  const view = render(
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </ApiProvider>
    </QueryClientProvider>,
  );
  return view;
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function routeFetch(handlers: Record<string, () => Response>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
    if (path === "/api/health") return jsonResponse(200, { ok: true });
    const handler = handlers[path];
    if (!handler) return jsonResponse(404, { error: "NOT_FOUND", message: "Introuvable" });
    return handler();
  }) as typeof fetch;
}

export type { ReactElement };
