interface RankedBarsProps {
  rows: ReadonlyArray<{ name: string; value: number }>;
  /** Text for assistive technology that explains the unit, e.g. "rounds". */
  unit: (value: number) => string;
}

/**
 * Magnitudes on one shared baseline, largest first, in a single colour. Each
 * row carries its own name and figure, so nothing depends on hover or colour.
 */
export function RankedBars({ rows, unit }: RankedBarsProps) {
  const max = rows.reduce((highest, row) => Math.max(highest, row.value), 0);
  return (
    <ul className="stagger-children flex flex-col gap-3.5">
      {rows.map((row) => (
        <li key={row.name} title={`${row.name}: ${unit(row.value)}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-semibold">{row.name}</span>
            <span className="tabular shrink-0 text-sm font-bold">
              {row.value}
              <span className="sr-only"> {unit(row.value)}</span>
            </span>
          </div>
          <div className="mt-1.5 h-2.5" aria-hidden="true">
            {row.value > 0 ? (
              <div className="animate-grow-x origin-start h-full min-w-1 rounded-r-[4px] bg-brand-fg" style={{ width: `${(row.value / max) * 100}%` }} />
            ) : (
              <div className="h-full w-px bg-line-strong" />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
