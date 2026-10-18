const KEY = "jk.deviceId";

export function getDeviceId(storage: Storage = localStorage): string {
  const existing = storage.getItem(KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  storage.setItem(KEY, created);
  return created;
}
