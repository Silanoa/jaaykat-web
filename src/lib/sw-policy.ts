const CACHEABLE_GET = new Set(["/api/dashboard", "/api/sales", "/api/score"]);

export function isCacheableApiRequest(method: string, pathname: string): boolean {
  return method === "GET" && CACHEABLE_GET.has(pathname);
}
