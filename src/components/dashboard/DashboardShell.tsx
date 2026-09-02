"use client";

import { useState } from "react";
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

const HEALTH_LEGEND: { status: HealthStatus; dot: string; label: string }[] = [
  { status: "green", dot: "bg-emerald-400", label: "On track (within 10%)" },
  { status: "yellow", dot: "bg-amber-400", label: "At risk (10–25% miss)" },
  { status: "red", dot: "bg-red-400", label: "Off track (>25% miss)" },
  { status: "gray", dot: "bg-gray-400", label: "No budget set" },
];

/** Dot color + label meaning for the Net Income vs budget health indicator —
 * previously only readable via hover tooltip on each individual dot. A
 * Fortune-500 ops tool doesn't make you hover five times to learn a rule. */
function HealthLegend() {
  return (
    <div className="px-4 pt-3 pb-4 border-b border-white/10 space-y-1.5">
      <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">Net income vs budget</p>
      {HEALTH_LEGEND.map(({ status, dot, label }) => (
        <div key={status} className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
          <span className="text-[11px] text-white/50 leading-tight">{label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Location-first left sidebar shell — replaces the old top-tab-bar
 * (LocationTabs) as the app's primary navigation axis per the 2026-08-19
 * rebuild spec. Solid teal sidebar, "25N Coworking" wordmark in orange,
 * Consolidated + the 5 locations, active item gets a 3px orange left
 * border + bold white text, inactive items sit at ~70% white opacity.
 *
 * Below md (768px) the sidebar collapses behind a top bar + hamburger —
 * previously the nav rail stayed permanently open on phone, eating ~40% of
 * a 390px screen with no way to dismiss it (2026-08-24 UI audit finding #1).
 */
export function DashboardShell({ active, onChange, flagCounts, healthStatuses, children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navContent = (onNavigate: (loc: LocationTab) => void) => (
    <>
      <HealthLegend />
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        <SidebarItem
          label="Consolidated"
          active={active === "Consolidated"}
          onClick={() => onNavigate("Consolidated")}
        />
        <div className="h-px bg-white/10 my-2 mx-3" aria-hidden />
        {LOCATIONS.map((loc) => (
          <SidebarItem
            key={loc}
            label={loc}
            active={active === loc}
            onClick={() => onNavigate(loc)}
            flagCount={flagCounts?.[loc]}
            health={healthStatuses?.[loc]}
          />
        ))}
      </nav>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Mobile top bar — replaces the permanent sidebar below md */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#1F3642] flex-shrink-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-extrabold tracking-tight text-[#F15B27]">25N</span>
          <span className="text-sm font-medium text-white/70">Coworking</span>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open location menu"
          aria-expanded={drawerOpen}
          className="p-1.5 -mr-1.5 rounded text-white/80 hover:text-white hover:bg-white/10 cursor-pointer transition-colors duration-150"
        >
          <span className="text-sm font-medium mr-1.5 align-middle">{active}</span>
          <svg className="w-5 h-5 inline-block align-middle" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </div>

      {/* Mobile drawer + scrim */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside className="relative w-72 max-w-[80vw] bg-[#1F3642] flex flex-col h-full">
            <div className="flex items-center justify-between px-5 pt-6 pb-5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-extrabold tracking-tight text-[#F15B27]">25N</span>
                <span className="text-sm font-medium text-white/70">Coworking</span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close location menu"
                className="p-1 rounded text-white/60 hover:text-white cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {navContent((loc) => { onChange(loc); setDrawerOpen(false); })}
          </aside>
        </div>
      )}

      {/* Desktop sidebar — unchanged, always visible at md and above */}
      <aside className="hidden md:flex w-60 flex-shrink-0 bg-[#1F3642] flex-col">
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold tracking-tight text-[#F15B27]">25N</span>
            <span className="text-sm font-medium text-white/70">Coworking</span>
          </div>
        </div>
        {navContent(onChange)}
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
        // Selection state reads through the white left border + bg tint,
        // not a brand-orange border — orange stays reserved for the health
        // dot's "off track" meaning and primary actions, so a selected
        // off-track location doesn't read as one orange smear (2026-08-24
        // UI audit finding #2).
        active
          ? "border-white/60 bg-white/[0.06] font-bold text-white"
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
