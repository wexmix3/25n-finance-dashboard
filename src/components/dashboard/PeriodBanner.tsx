"use client";

import { useState } from "react";

interface Props {
  currentMonth: string;
  priorMonth: string;
  uploadedAt?: string;
  locked?: boolean;
  role?: string;
  location?: string;
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

export function PeriodBanner({ currentMonth, priorMonth, uploadedAt, locked, role, location }: Props) {
  const [isLocked, setIsLocked] = useState(locked ?? false);
  const [locking, setLocking] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState(false);

  const pacing = uploadedAt && currentMonth !== "—" ? computePacing(currentMonth, uploadedAt) : null;
  const pacingPct = pacing ? Math.round((pacing.daysElapsed / pacing.daysInMonth) * 100) : null;
  const isFull = pacing ? pacing.daysElapsed === pacing.daysInMonth : false;

  const uploadLabel = uploadedAt
    ? `updated ${new Date(uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
    : "no data";

  async function handleLock() {
    if (!location || !priorMonth || isLocked) return;
    setLocking(true);
    setConfirmLock(false);
    try {
      const res = await fetch("/api/dashboard/lock-period", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, month: priorMonth }),
      });
      if (res.ok) setIsLocked(true);
    } finally {
      setLocking(false);
    }
  }

  async function handleUnlock() {
    if (!location || !priorMonth || !isLocked) return;
    setUnlocking(true);
    setConfirmUnlock(false);
    try {
      const res = await fetch("/api/dashboard/unlock-period", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, month: priorMonth }),
      });
      if (res.ok) setIsLocked(false);
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 pb-3">
      <div className="flex items-center gap-5">
        {/* Current period */}
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-gray-900">{currentMonth}</span>
          {isFull ? (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Final</span>
          ) : (
            <span className="text-xs font-semibold text-[#E07A3E] bg-[#fdf2e9] px-1.5 py-0.5 rounded">MTD</span>
          )}
          {pacing && !isFull && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              Day {pacing.daysElapsed}/{pacing.daysInMonth}
              <span className="text-gray-400 font-normal">·</span>
              <span className="text-gray-600">{pacingPct}%</span>
            </span>
          )}
          <span className="text-xs text-gray-400">{uploadLabel}</span>
        </div>

        <div className="h-4 w-px bg-gray-200" />

        {/* Prior period */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-400">{priorMonth}</span>
          {isLocked ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700">
                Final
              </span>
              {role === "admin" && !confirmUnlock && (
                <button
                  onClick={() => setConfirmUnlock(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border border-gray-200 text-gray-400 hover:border-amber-400 hover:text-amber-600 transition-colors duration-150 cursor-pointer"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  Unlock
                </button>
              )}
              {role === "admin" && confirmUnlock && (
                <>
                  <span className="text-xs text-gray-600 font-medium">Unlock {priorMonth}?</span>
                  <button
                    onClick={handleUnlock}
                    disabled={unlocking}
                    className="text-xs px-2 py-0.5 rounded bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors duration-150 disabled:opacity-50 cursor-pointer"
                  >
                    {unlocking ? "Unlocking…" : "Confirm"}
                  </button>
                  <button
                    onClick={() => setConfirmUnlock(false)}
                    className="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-500 hover:text-gray-700 transition-colors duration-150 cursor-pointer"
                  >
                    Cancel
                  </button>
                </>
              )}
            </span>
          ) : role === "admin" && priorMonth !== "—" ? (
            confirmLock ? (
              <span className="flex items-center gap-1.5">
                <span className="text-xs text-gray-600 font-medium">Lock {priorMonth}? This is permanent.</span>
                <button
                  onClick={handleLock}
                  disabled={locking}
                  className="text-xs px-2 py-0.5 rounded bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors duration-150 disabled:opacity-50 cursor-pointer"
                >
                  {locking ? "Locking…" : "Confirm"}
                </button>
                <button
                  onClick={() => setConfirmLock(false)}
                  className="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-500 hover:text-gray-700 transition-colors duration-150 cursor-pointer"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmLock(true)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border border-gray-300 text-gray-500 hover:border-[#E07A3E]/50 hover:text-[#E07A3E] transition-colors duration-150 cursor-pointer"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                Lock period
              </button>
            )
          ) : null}
        </div>
      </div>

    </div>
  );
}
