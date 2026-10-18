type InstallEvent = Event & { prompt: () => Promise<void> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

export function bindInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallEvent;
    listeners.forEach((listener) => listener());
  });
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function canPromptInstall(): boolean {
  return deferred !== null;
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  deferred = null;
  listeners.forEach((listener) => listener());
  return true;
}

export function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || navigatorHasStandalone();
}

function navigatorHasStandalone(): boolean {
  return "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}
