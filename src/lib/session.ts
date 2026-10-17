export const SESSION_KEY = "jk.session";

export type StoredSession = {
  token: string;
  expiresAt: string;
};

export function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

export function readStoredSession(storage: Storage, nowMs = Date.now()): StoredSession | null {
  const raw = storage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed.token !== "string" || typeof parsed.expiresAt !== "string") {
      storage.removeItem(SESSION_KEY);
      return null;
    }
    if (Date.parse(parsed.expiresAt) <= nowMs) {
      storage.removeItem(SESSION_KEY);
      return null;
    }
    return { token: parsed.token, expiresAt: parsed.expiresAt };
  } catch {
    storage.removeItem(SESSION_KEY);
    return null;
  }
}

export function writeStoredSession(storage: Storage, session: StoredSession): void {
  storage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearStoredSession(storage: Storage): void {
  storage.removeItem(SESSION_KEY);
}
