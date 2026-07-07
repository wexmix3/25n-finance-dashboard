"use client";

import { LOCATIONS, Location } from "@/types/dashboard";

interface Props {
  active: Location;
  onChange: (loc: Location) => void;
}

export function LocationTabs({ active, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 border-b border-gray-200">
      {LOCATIONS.map((loc) => (
        <button
          key={loc}
          onClick={() => onChange(loc)}
          className={[
            "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
            active === loc
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
          ].join(" ")}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
