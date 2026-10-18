const target = new EventTarget();

export function emitUnauthenticated(): void {
  target.dispatchEvent(new Event("lost"));
}

export function subscribeUnauthenticated(listener: () => void): () => void {
  target.addEventListener("lost", listener);
  return () => target.removeEventListener("lost", listener);
}
