"use client";

import { LOCATIONS, Location } from "@/types/dashboard";

export type LocationTab = Location | "Consolidated";

type HealthStatus = "green" | "yellow" | "red";

interface Props {
  active: LocationTab;
  onChange: (loc: LocationTab) => void;
  flagCounts?: Partial<Record<Location, number>>;
  healthStatuses?: Partial<Record<Location, HealthStatus>>;
}

export function LocationTabs({ active, onChange, flagCounts, healthStatuses }: Props) {
  const hasHealth = LOCATIONS.some(l => healthStatuses?.[l]);
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-1 pt-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0">
      {/* Consolidated — all locations, no single period assumed */}
      <button
        onClick={() => onChange("Consolidated")}
        className={[
          "flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors duration-150 cursor-pointer whitespace-nowrap",
          active === "Consolidated"
            ? "border-[#E07A3E] text-[#E07A3E] bg-[#fdf2e9]/60 rounded-t"
            : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300",
        ].join(" ")}
      >
        Consolidated
      </button>
      <span className="w-px h-6 bg-gray-200 flex-shrink-0 mx-0.5" aria-hidden />
      {LOCATIONS.map((loc) => {
        const flags = flagCounts?.[loc] ?? 0;
        const health = healthStatuses?.[loc];
        return (
          <button
            key={loc}
            onClick={() => onChange(loc)}
            className={[
              "flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors duration-150 cursor-pointer",
              active === loc
                ? "border-[#E07A3E] text-[#E07A3E]"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300",
            ].join(" ")}
          >
            {health && (
              <span
                title={`NOI vs budget: ${health === "green" ? "on track (within 10%)" : health === "yellow" ? "at risk (10–25% miss)" : "off track (>25% miss)"}`}
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  health === "green" ? "bg-emerald-500" :
                  health === "yellow" ? "bg-amber-400" : "bg-red-500"
                }`}
              />
            )}
            {loc}
            {flags > 0 && (
              <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full bg-red-500 text-white leading-none">
                {flags}
              </span>
            )}
          </button>
        );
      })}
        </div>
        {/* Health legend — inline right */}
        {hasHealth && (
          <div className="hidden sm:flex items-center gap-2 border border-gray-200 rounded px-2 py-1 flex-shrink-0 mb-1 mr-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pr-1 border-r border-gray-200">NOI</span>
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block flex-shrink-0" />On pace
            </div>
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block flex-shrink-0" />At risk
            </div>
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block flex-shrink-0" />Off track
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
