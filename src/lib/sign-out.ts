import type { ApiClient } from "./api";
import { queryClient } from "./query-client";
import { useSession } from "../stores/session";
import { useToast } from "../stores/toast";

export async function signOut(api: Pick<ApiClient, "logout">, online: boolean): Promise<void> {
  if (online) {
    try {
      await api.logout();
    } catch {
      useToast.getState().show("Déconnexion locale : le serveur n'a pas répondu.");
    }
  }
  await clearLocalData();
}

export async function clearLocalData(): Promise<void> {
  useSession.getState().clear();
  queryClient.clear();
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}
