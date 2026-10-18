export function celebratePayment(
  id: string,
  seen: Set<string>,
  hooks: { beep: () => void; vibrate: (pattern: number[]) => void },
): boolean {
  if (seen.has(id)) return false;
  seen.add(id);
  hooks.beep();
  hooks.vibrate([80, 40, 80]);
  return true;
}

export function beep(): void {
  if (typeof window.AudioContext !== "function") return;
  const ctx = new window.AudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.frequency.value = 880;
  oscillator.type = "sine";
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.42);
  oscillator.onended = () => {
    void ctx.close();
  };
}

export function vibratePayment(): void {
  navigator.vibrate?.([80, 40, 80]);
}
