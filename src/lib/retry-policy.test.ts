import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ApiError, createApi } from "./api";
import { queryClient } from "./query-client";
import { shouldRetry } from "./resilience";

describe("politique de reessai des requetes", () => {
  it.each([400, 401, 403, 404, 409, 422])("ne reessaie jamais un %i", (status) => {
    expect(shouldRetry(0, new ApiError(status, "X", "x"))).toBe(false);
  });

  it.each([408, 429, 500, 502, 503])("reessaie un %i dans la limite de 3 reprises", (status) => {
    const error = new ApiError(status, "X", "x");
    expect(shouldRetry(0, error)).toBe(true);
    expect(shouldRetry(2, error)).toBe(true);
    expect(shouldRetry(3, error)).toBe(false);
  });

  it("reessaie une panne reseau", () => {
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
  });

  it("applique la meme politique par defaut et jamais aux mutations", () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.retry).toBe(shouldRetry);
    expect(defaults.mutations?.retry).toBe(false);
  });
});

describe("requetes POST du client HTTP", () => {
  const storage = new Map<string, string>();
  const fakeStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
    clear: () => storage.clear(),
    key: () => null,
    length: 0,
  } as Storage;

  it("n'envoie qu'une seule fois chaque ecriture, meme sur 503", async () => {
    let calls = 0;
    const api = createApi({
      storage: fakeStorage,
      fetch: (async () => {
        calls += 1;
        return new Response(JSON.stringify({ error: "BITNOB_UNAVAILABLE", message: "indisponible" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
    });
    const writes: Array<() => Promise<unknown>> = [
      () => api.register({ shopName: "Awa", category: "beaute", firstName: "Awa", lastName: "Diop", phone: "771234567", pin: "482915" }),
      () => api.login({ phone: "771234567", pin: "482915" }),
      () => api.createInvoice({ amountXof: 1000 }, "key-1"),
      () => api.createPublicInvoice({ slug: "awa", amountXof: 1000 }, "key-2"),
      () => api.quotePayout({ amountXof: 1000, network: "wave", accountNumber: "771234567", accountName: "Awa" }),
      () => api.createPayout("quote-1", "key-3"),
      () => api.shareScore(),
      () => api.payPublicInvoice("inv-1", "yas"),
    ];
    for (const write of writes) {
      const before = calls;
      await expect(write()).rejects.toMatchObject({ status: 503 });
      expect(calls - before).toBe(1);
    }
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) && !path.includes(join("src", "test")) ? [path] : [];
  });
}

describe("garde-fous du code source", () => {
  const files = sourceFiles(join(process.cwd(), "src"));

  it("n'utilise que shouldRetry ou false comme politique retry", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/\bretry:\s*([^,\n]+)/g)) {
        const value = (match[1] ?? "").replace(/[\s});]+$/, "");
        if (value !== "shouldRetry" && value !== "false") offenders.push(`${file}: retry: ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("n'utilise ni useMutation ni requete useQuery sur une ecriture", () => {
    const offenders: string[] = [];
    const writes = /api\.(register|login|logout|createInvoice|createPublicInvoice|quotePayout|createPayout|shareScore|payPublicInvoice)\(/;
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (text.includes("useMutation")) offenders.push(`${file}: useMutation`);
      for (const match of text.matchAll(/queryFn:[^\n]*/g)) {
        if (writes.test(match[0])) offenders.push(`${file}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
