import { ScoreMark } from "./score-mark";
import { cn } from "@/lib/cn";
import { totalStrokes, type HoleInfo, type Strokes } from "@/lib/golf/scoring";

export interface ScorecardRow {
  id: string;
  name: string;
  scores: readonly Strokes[];
  highlight?: boolean;
  /** Shown after the name, e.g. a guest badge. */
  suffix?: string;
}

export interface ScorecardLabels {
  hole: string;
  par: string;
  out: string;
  in: string;
  total: string;
}

interface ScorecardTableProps {
  holes: readonly HoleInfo[];
  rows: readonly ScorecardRow[];
  labels: ScorecardLabels;
  /** 0-based hole to highlight, e.g. the one being played. */
  activeHole?: number;
  className?: string;
}

const NINE = 9;

/** `Sanne de Vries` → `Sanne V.`: the name column is narrow on a phone. */
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

function sum(values: readonly Strokes[]): number | null {
  return values.some((value) => value !== null) ? totalStrokes(values) : null;
}

/**
 * The full card in scorecard notation. Eighteen holes are shown as two nines
 * stacked, which stays readable on a phone without sideways scrolling.
 */
export function ScorecardTable({ holes, rows, labels, activeHole, className }: ScorecardTableProps) {
  const halves = holes.length > NINE ? [0, NINE] : [0];
  const showGrandTotal = halves.length > 1;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {halves.map((start, half) => {
        const slice = holes.slice(start, start + NINE);
        const subtotalLabel = showGrandTotal ? (half === 0 ? labels.out : labels.in) : labels.total;
        return (
          <div key={start} className="overflow-x-auto scrollbar-none">
            <table className="w-full min-w-[18.5rem] table-fixed border-separate border-spacing-0 text-center tabular">
              <thead>
                <tr className="font-label text-[10px] text-ink-3">
                  <th scope="col" className="w-[4.1rem] pb-1.5 pl-1 text-left font-[inherit] sm:w-[26%]">
                    {labels.hole}
                  </th>
                  {slice.map((hole, index) => (
                    <th
                      key={hole.number}
                      scope="col"
                      className={cn("pb-1.5 font-[inherit]", activeHole === start + index && "text-brand-fg")}
                    >
                      {hole.number}
                    </th>
                  ))}
                  <th scope="col" className="w-10 pb-1.5 pr-1 text-right font-[inherit] sm:w-14">
                    {subtotalLabel}
                  </th>
                </tr>
                <tr className="text-[12px] text-ink-3">
                  <th scope="row" className="border-y border-line bg-well py-1.5 pl-2 text-left font-medium first:rounded-l-lg">
                    {labels.par}
                  </th>
                  {slice.map((hole) => (
                    <td key={hole.number} className="border-y border-line bg-well py-1.5">
                      {hole.par}
                    </td>
                  ))}
                  <td className="rounded-r-lg border-y border-line bg-well py-1.5 pr-2 text-right font-semibold">
                    {slice.reduce((total, hole) => total + hole.par, 0)}
                  </td>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const scores = row.scores.slice(start, start + NINE);
                  const subtotal = sum(scores);
                  return (
                    <tr key={row.id} className={cn(row.highlight && "[--surface:var(--brand-soft)] [&>*]:bg-brand-soft")}>
                      <th
                        scope="row"
                        title={row.name}
                        className="max-w-0 truncate border-b border-line py-2 pl-2 text-left text-[13px] font-semibold first:rounded-l-lg"
                      >
                        <span className="sm:hidden">{shortName(row.name)}</span>
                        <span className="hidden sm:inline">{row.name}</span>
                        {row.suffix ? <span className="ml-1 font-normal text-ink-3">{row.suffix}</span> : null}
                      </th>
                      {slice.map((hole, index) => (
                        <td key={hole.number} className="border-b border-line py-2">
                          <ScoreMark strokes={scores[index] ?? null} par={hole.par} size="sm" />
                        </td>
                      ))}
                      <td className="font-score border-b border-line py-2 pr-2 text-right text-base last:rounded-r-lg">
                        {subtotal ?? "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {showGrandTotal ? (
        <dl className="flex flex-col gap-1.5 border-t border-line pt-3">
          {rows.map((row) => (
            <div key={row.id} className="flex items-baseline justify-between gap-3 px-1">
              <dt className="truncate text-[13px] font-semibold">{row.name}</dt>
              <dd className="font-score text-lg">{sum(row.scores) ?? "–"}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
