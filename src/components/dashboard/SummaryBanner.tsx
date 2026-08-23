import { Location, LOCATIONS } from "@/types/dashboard";

type HealthStatus = "green" | "yellow" | "red" | "gray";

interface Props {
  healthStatuses: Partial<Record<Location, HealthStatus>>;
  currentMonth: string;
  pacingPct: number | null;
}

function buildSummary(
  healthStatuses: Partial<Record<Location, HealthStatus>>,
  currentMonth: string,
  pacingPct: number | null
): { text: string; tone: "good" | "warn" | "bad" | "neutral" } {
  // "gray" (no budget set yet, e.g. pre-opening Uptown) isn't a scored
  // pace/budget outcome — exclude it here the same way undefined always
  // was, so it doesn't skew the "X of Y locations on pace" count.
  const scored = LOCATIONS.filter(l => healthStatuses[l] === "green" || healthStatuses[l] === "yellow" || healthStatuses[l] === "red");
  if (scored.length === 0) return { text: "Upload financial data to see performance summary.", tone: "neutral" };

  const green = scored.filter(l => healthStatuses[l] === "green");
  const yellow = scored.filter(l => healthStatuses[l] === "yellow");
  const red = scored.filter(l => healthStatuses[l] === "red");
  const atRisk = [...red, ...yellow];
  const pacingStr = pacingPct !== null && pacingPct < 1 ? ` (${Math.round(pacingPct * 100)}% through ${currentMonth})` : ` — ${currentMonth}`;

  if (green.length === scored.length) {
    return { text: `All ${scored.length} locations on pace vs budget${pacingStr}.`, tone: "good" };
  }
  if (red.length === scored.length) {
    return { text: `All locations behind budget${pacingStr} — review needed.`, tone: "bad" };
  }
  if (atRisk.length === 1) {
    const label = atRisk[0];
    return {
      text: `${green.length} of ${scored.length} locations on pace${pacingStr} · ${label} ${red.includes(label as Location) ? "is off track" : "is at risk"}.`,
      tone: red.length > 0 ? "warn" : "warn",
    };
  }
  const redNames = red.join(", ");
  const yellowNames = yellow.join(", ");
  const atRiskStr = [...(red.length ? [`${redNames} off track`] : []), ...(yellow.length ? [`${yellowNames} at risk`] : [])].join(" · ");
  return {
    text: `${green.length} of ${scored.length} locations on pace${pacingStr} · ${atRiskStr}.`,
    tone: red.length > 0 ? "bad" : "warn",
  };
}

export function SummaryBanner({ healthStatuses, currentMonth, pacingPct }: Props) {
  const { text, tone } = buildSummary(healthStatuses, currentMonth, pacingPct);

  const leftBorder = {
    good: "border-l-emerald-400",
    warn: "border-l-amber-400",
    bad: "border-l-red-400",
    neutral: "border-l-gray-300",
  };

  const dotColor = {
    good: "bg-emerald-400",
    warn: "bg-amber-400",
    bad: "bg-red-400",
    neutral: "bg-gray-300",
  };

  return (
    <div className={`flex items-center gap-3 bg-white rounded-lg border border-gray-200 border-l-4 px-4 py-2.5 ${leftBorder[tone]}`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor[tone]}`} />
      <p className="text-sm text-gray-700 font-medium">{text}</p>
    </div>
  );
}
