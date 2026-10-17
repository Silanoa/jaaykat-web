import { create } from "zustand";
import type { AuthSuccess, Me, MerchantProfile, UserProfile } from "../lib/schemas";
import { clearStoredSession, readStoredSession, writeStoredSession } from "../lib/session";

const PROFILE_KEY = "jk.profile";
const CACHED_AT_KEY = "jk.cachedAt";

type Profile = { user: UserProfile; merchant: MerchantProfile };

function readProfile(): Profile | null {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}

type SessionState = {
  token: string | null;
  expiresAt: string | null;
  user: UserProfile | null;
  merchant: MerchantProfile | null;
  cachedAt: string | null;
  hydrate: () => void;
  setAuth: (auth: AuthSuccess) => void;
  setProfile: (me: Me) => void;
  setCachedAt: (iso: string) => void;
  clear: () => void;
};

export const useSession = create<SessionState>((set) => ({
  token: null,
  expiresAt: null,
  user: null,
  merchant: null,
  cachedAt: null,
  hydrate() {
    const session = readStoredSession(localStorage);
    const profile = session ? readProfile() : null;
    set({
      token: session?.token ?? null,
      expiresAt: session?.expiresAt ?? null,
      user: profile?.user ?? null,
      merchant: profile?.merchant ?? null,
      cachedAt: localStorage.getItem(CACHED_AT_KEY),
    });
  },
  setAuth(auth) {
    writeStoredSession(localStorage, { token: auth.token, expiresAt: auth.expiresAt });
    const profile = { user: auth.user, merchant: auth.merchant };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    set({ token: auth.token, expiresAt: auth.expiresAt, user: auth.user, merchant: auth.merchant });
  },
  setProfile(me) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ user: me.user, merchant: me.merchant }));
    set({ user: me.user, merchant: me.merchant });
  },
  setCachedAt(iso) {
    localStorage.setItem(CACHED_AT_KEY, iso);
    set({ cachedAt: iso });
  },
  clear() {
    clearStoredSession(localStorage);
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(CACHED_AT_KEY);
    set({ token: null, expiresAt: null, user: null, merchant: null, cachedAt: null });
  },
}));
