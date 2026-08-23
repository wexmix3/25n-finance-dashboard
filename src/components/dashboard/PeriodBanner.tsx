"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Location } from "@/types/dashboard";

interface Props {
  currentMonth: string;
  priorMonth: string;
  uploadedAt?: string;
  /** Lock status for the prior-period slot (kept as its own prop for
   * backwards compat with existing callers/behavior). */
  locked?: boolean;
  /** Lock status for the current-period slot — current period previously had
   * no lock display at all. */
  currentLocked?: boolean;
  /** Caller's role — the toggle only renders for "admin"; everyone else sees
   * the same read-only "Final" badge that existed before. */
  role?: string;
  /** Location the active month belongs to, needed for the lock-period API call. */
  location?: Location;
  /** Fired after a successful lock/unlock so the caller can update any local
   * state that mirrors lock status (in addition to the router.refresh() this
   * component triggers itself). */
  onLockChange?: (month: string, locked: boolean) => void;
}

function computePacing(month: string, uploadedAt: string): { daysElapsed: number; daysInMonth: number } | null {
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [monStr, yearStr] = month.split(" ");
  const monthIdx = monthNames.indexOf(monStr);
  const year = parseInt(yearStr);
  if (monthIdx === -1 || isNaN(year)) return null;
  // UTC throughout: the server (Vercel, UTC) and the browser (Eastern) would
  // otherwise read a different calendar day off the same timestamp whenever
  // an upload lands late evening Eastern (already past midnight UTC), which
  // makes the SSR'd text and the hydrated text disagree (React error #418).
  const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  const uploadDate = new Date(uploadedAt);
  if (uploadDate.getUTCFullYear() === year && uploadDate.getUTCMonth() === monthIdx) {
    return { daysElapsed: uploadDate.getUTCDate(), daysInMonth };
  }
  // Upload is in a later month — this is a closed period, full month elapsed
  return { daysElapsed: daysInMonth, daysInMonth };
}

/** Admin-only lock/unlock control for one period slot. Non-admins (and any
 * slot missing the location/month needed to call the API) fall back to the
 * original read-only "Final" badge — shown only when locked, silent
 * otherwise, so nothing changes for viewer-role users. */
function LockIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.6-1.8" />
    </svg>
  ) : (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function LockControl({
  location,
  month,
  locked,
  isAdmin,
  onLockChange,
  /** "primary" is the bold current-period pill; "muted" is a quieter, icon-led
   * treatment for the prior-period utility slot so it doesn't read as a
   * second, competing period tab. */
  variant = "primary",
}: {
  location?: Location;
  month: string;
  locked?: boolean;
  isAdmin: boolean;
  onLockChange?: (month: string, locked: boolean) => void;
  variant?: "primary" | "muted";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [localLocked, setLocalLocked] = useState(!!locked);
  const [syncedLocked, setSyncedLocked] = useState(locked);

  // Keep in sync if the server-derived prop changes (e.g. switching months
  // via the pill row) — this is the render-time "getDerivedStateFromProps"
  // pattern (state var + comparison, no effect) rather than useEffect, so a
  // month switch is reflected on the same render instead of one tick later.
  if (locked !== syncedLocked) {
    setSyncedLocked(locked);
    setLocalLocked(!!locked);
  }

  if (!isAdmin || !location || month === "—") {
    return locked ? (
      <span
        className={
          variant === "muted"
            ? "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-gray-400"
            : "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-600"
        }
      >
        {variant === "muted" && <LockIcon open={false} />}
        Final
      </span>
    ) : null;
  }

  async function toggleLock() {
    const next = !localLocked;
    setPending(true);
    try {
      const resp = await fetch(`/api/dashboard/${next ? "lock-period" : "unlock-period"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, month }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        alert(`Couldn't ${next ? "lock" : "unlock"} ${month}: ${body.error ?? resp.statusText}`);
        return;
      }
      setLocalLocked(next);
      onLockChange?.(month, next);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (variant === "muted") {
    return (
      <button
        onClick={toggleLock}
        disabled={pending}
        title={localLocked ? `${month} is locked — click to unlock` : `${month} is unlocked — click to lock`}
        className={[
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-wait",
          localLocked
            ? "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            : "text-[#F15B27]/70 hover:text-[#F15B27] hover:bg-[#fdf2e9]",
        ].join(" ")}
      >
        <LockIcon open={!localLocked} />
        {localLocked ? "Unlock" : "Lock"}
      </button>
    );
  }

  return (
    <button
      onClick={toggleLock}
      disabled={pending}
      title={localLocked ? `${month} is locked — click to unlock` : `${month} is unlocked — click to lock`}
      className={[
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold border transition-colors duration-150 cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-wait",
        localLocked
          ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
          : "bg-[#fdf2e9] text-[#F15B27] border-[#F15B27]/40 hover:bg-[#fbe3ce]",
      ].join(" ")}
    >
      {localLocked ? "Final · Unlock" : "Lock period"}
    </button>
  );
}

export function PeriodBanner({ currentMonth, priorMonth, uploadedAt, locked, currentLocked, role, location, onLockChange }: Props) {
  const pacing = uploadedAt && currentMonth !== "—" ? computePacing(currentMonth, uploadedAt) : null;
  const pacingPct = pacing ? Math.round((pacing.daysElapsed / pacing.daysInMonth) * 100) : null;
  const isFull = pacing ? pacing.daysElapsed === pacing.daysInMonth : false;
  const isAdmin = role === "admin";

  const uploadLabel = uploadedAt
    ? `updated ${new Date(uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
    : "no data";

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 pb-3">
      <div className="flex items-center gap-5">
        {/* Current period */}
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-gray-900">{currentMonth}</span>
          {isFull ? (
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Final</span>
          ) : (
            <span className="text-xs font-semibold text-[#F15B27] bg-[#fdf2e9] px-1.5 py-0.5 rounded">MTD</span>
          )}
          {pacing && !isFull && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              Day {pacing.daysElapsed}/{pacing.daysInMonth}
              <span className="text-gray-400 font-normal">·</span>
              <span className="text-gray-600">{pacingPct}%</span>
            </span>
          )}
          <span className="text-xs text-gray-400">{uploadLabel}</span>
          <LockControl
            location={location}
            month={currentMonth}
            locked={currentLocked}
            isAdmin={isAdmin}
            onLockChange={onLockChange}
          />
        </div>

        <div className="h-4 w-px bg-gray-200" />

        {/* Prior period — a correction-access utility (unlock a already-Final
            month for a late GL fix), not a second navigable period tab. Kept
            visually muted/labeled so it doesn't compete with the bold current-
            period slot on the left. Read-only "Final" status for non-admins;
            admins get the lock/unlock toggle (restored 2026-08-23 after
            2026-08-19 removal — Max wants it back, scoped to whichever month
            is actually selected rather than hardcoded to "prior period"). */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-300">Prior</span>
          <span className="text-sm font-medium text-gray-400">{priorMonth}</span>
          <LockControl
            location={location}
            month={priorMonth}
            locked={locked}
            isAdmin={isAdmin}
            onLockChange={onLockChange}
            variant="muted"
          />
        </div>
      </div>

    </div>
  );
}
