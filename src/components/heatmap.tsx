import { useState } from "react";
import { formatXof } from "../lib/format";
import type { Dashboard } from "../lib/schemas";

const DAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const HOURS = Array.from({ length: 18 }, (_, index) => index + 6);

type Cell = Dashboard["heatmap"][number];

export function Heatmap({ cells }: { cells: Cell[] }) {
  const [selected, setSelected] = useState<Cell | null>(null);
  const max = Math.max(1, ...cells.map((cell) => cell.revenueXof));

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[560px] gap-1" style={{ gridTemplateColumns: "40px repeat(18, minmax(24px, 1fr))" }}>
          <span />
          {HOURS.map((hour) => (
            <span key={hour} className="text-center text-xs text-subtle">
              {hour}
            </span>
          ))}
          {DAYS.map((day, weekday) => (
            <DayRow
              key={day}
              day={day}
              weekday={weekday}
              cells={cells}
              max={max}
              onSelect={setSelected}
            />
          ))}
        </div>
      </div>
      {selected ? (
        <p role="status" className="mt-2 rounded-xl bg-surface px-3 py-2 text-sm">
          {DAYS[selected.weekday]} {selected.hour}h · {selected.salesCount} vente{selected.salesCount > 1 ? "s" : ""} ·{" "}
          {formatXof(selected.revenueXof)}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">Touchez une case pour le détail.</p>
      )}
    </div>
  );
}

function DayRow({
  day,
  weekday,
  cells,
  max,
  onSelect,
}: {
  day: string;
  weekday: number;
  cells: Cell[];
  max: number;
  onSelect: (cell: Cell) => void;
}) {
  return (
    <>
      <span className="self-center text-xs text-muted">{day}</span>
      {HOURS.map((hour) => {
        const cell = cells.find((item) => item.weekday === weekday && item.hour === hour) ?? {
          weekday,
          hour,
          salesCount: 0,
          revenueXof: 0,
        };
        const level = cell.revenueXof <= 0 ? 0 : Math.min(4, Math.ceil((cell.revenueXof / max) * 4));
        const tone = ["bg-black/5", "bg-primary/20", "bg-primary/40", "bg-primary/70", "bg-primary"][level];
        return (
          <button
            key={`${weekday}-${hour}`}
            type="button"
            aria-label={`${day} ${hour}h, ${cell.salesCount} ventes, ${formatXof(cell.revenueXof)}`}
            data-dense="true"
            className={`min-h-8 rounded-sm ${tone}`}
            onClick={() => onSelect(cell)}
          />
        );
      })}
    </>
  );
}
