export function ScoreGauge({ score, band }: { score: number | null; band: string | null }) {
  const value = Math.max(0, Math.min(100, score ?? 0));
  const radius = 80;
  const length = Math.PI * radius;
  const dash = (value / 100) * length;
  const label = score === null ? "Score en construction" : `Score ${score}, bande ${band ?? "—"}`;
  return (
    <svg viewBox="0 0 200 120" className="mx-auto w-full max-w-[280px]" role="img" aria-label={label}>
      <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--color-brand-soft)" strokeWidth="16" strokeLinecap="round" />
      <path
        d="M20 100 A80 80 0 0 1 180 100"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${length}`}
      />
      <text x="100" y="88" textAnchor="middle" fontSize="36" fontWeight="700" fill="var(--color-ink)">
        {score ?? "—"}
      </text>
      <text x="100" y="112" textAnchor="middle" fontSize="14" fill="var(--color-muted)">
        {band ? `Bande ${band}` : "En construction"}
      </text>
    </svg>
  );
}
