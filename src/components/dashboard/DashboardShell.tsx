"use client";

import { LOCATIONS, Location } from "@/types/dashboard";

export type LocationTab = Location | "Consolidated";

type HealthStatus = "green" | "yellow" | "red" | "gray";

interface Props {
  active: LocationTab;
  onChange: (loc: LocationTab) => void;
  flagCounts?: Partial<Record<Location, number>>;
  healthStatuses?: Partial<Record<Location, HealthStatus>>;
  children: React.ReactNode;
}

/**
 * Location-first left sidebar shell — replaces the old top-tab-bar
 * (LocationTabs) as the app's primary navigation axis per the 2026-08-19
 * rebuild spec. Solid teal sidebar, "25N Coworking" wordmark in orange,
 * Consolidated + the 5 locations, active item gets a 3px orange left
 * border + bold white text, inactive items sit at ~70% white opacity.
 */
export function DashboardShell({ active, onChange, flagCounts, healthStatuses, children }: Props) {
  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-60 flex-shrink-0 bg-[#1F3642] flex flex-col">
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold tracking-tight text-[#F15B27]">25N</span>
            <span className="text-sm font-medium text-white/70">Coworking</span>
          </div>
        </div>

        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
          <SidebarItem
            label="Consolidated"
            active={active === "Consolidated"}
            onClick={() => onChange("Consolidated")}
          />
          <div className="h-px bg-white/10 my-2 mx-3" aria-hidden />
          {LOCATIONS.map((loc) => (
            <SidebarItem
              key={loc}
              label={loc}
              active={active === loc}
              onClick={() => onChange(loc)}
              flagCount={flagCounts?.[loc]}
              health={healthStatuses?.[loc]}
            />
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
}

function SidebarItem({
  label,
  active,
  onClick,
  flagCount,
  health,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  flagCount?: number;
  health?: HealthStatus;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full flex items-center gap-2 pl-3 pr-2.5 py-2.5 text-sm rounded-r-md transition-colors duration-150 cursor-pointer border-l-[3px]",
        active
          ? "border-[#F15B27] bg-white/[0.06] font-bold text-white"
          : "border-transparent text-white/70 hover:text-white hover:bg-white/[0.04] font-medium",
      ].join(" ")}
    >
      {health && (
        <span
          title={
            health === "gray"
              ? "Net Income vs budget: no budget set yet (pre-opening or not yet entered)"
              : `Net Income vs budget: ${health === "green" ? "on track (within 10%)" : health === "yellow" ? "at risk (10–25% miss)" : "off track (>25% miss)"}`
          }
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            health === "green"
              ? "bg-emerald-400"
              : health === "yellow"
              ? "bg-amber-400"
              : health === "red"
              ? "bg-red-400"
              : "bg-gray-400"
          }`}
        />
      )}
      <span className="flex-1 text-left truncate">{label}</span>
      {!!flagCount && (
        // Same 3-tier severity as the GL Check tab's own status pill (0 =
        // clean, 1–5 = amber "at risk", 6+ = red).
        <span
          className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full leading-none ${
            flagCount <= 5 ? "bg-amber-400 text-[#1F3642]" : "bg-red-400 text-white"
          }`}
        >
          {flagCount}
        </span>
      )}
    </button>
  );
}
