"use client";

import { useState } from "react";

interface Metric {
  name: string;
  formula: string;
  source: string;
  note?: string;
}

interface Section {
  title: string;
  metrics: Metric[];
}

const SECTIONS: Section[] = [
  {
    title: "Revenue",
    metrics: [
      { name: "Memberships", formula: "Sum of all membership plan charges for the period", source: "Yardi Scheduler_Reports — 12-Month Income Statement, accounts 4100–4199" },
      { name: "Meeting Space", formula: "Hourly and day-pass room bookings", source: "Yardi Scheduler_Reports, accounts 4200–4299" },
      { name: "Mail / Virtual", formula: "Virtual office and mail handling fees", source: "Yardi Scheduler_Reports, accounts 4300–4399" },
      { name: "Other Services", formula: "Printing, parking, event fees, and ancillary charges", source: "Yardi Scheduler_Reports, accounts 4400–4499" },
      { name: "Other Income", formula: "Non-operating income items not classified above", source: "Yardi Scheduler_Reports, accounts 4500–4599" },
      { name: "Total Revenue", formula: "Memberships + Meeting Space + Mail/Virtual + Other Services + Other Income", source: "Computed by build_statements.py" },
    ],
  },
  {
    title: "Cost of Sales",
    metrics: [
      { name: "Direct COS", formula: "Direct costs attributable to services delivered", source: "Yardi Scheduler_Reports, accounts 5000–5099" },
      { name: "Community", formula: "Coffee, snacks, member events, and community amenity costs", source: "Yardi Scheduler_Reports, accounts 5100–5199" },
    ],
  },
  {
    title: "Profitability",
    metrics: [
      { name: "Gross Profit", formula: "Total Revenue − Total Cost of Sales", source: "Computed by build_statements.py" },
      { name: "GP Margin %", formula: "Gross Profit ÷ Total Revenue × 100", source: "Computed by build_statements.py" },
      { name: "NOI (Net Operating Income)", formula: "Gross Profit − Total OPEX", source: "Computed by build_statements.py", note: "Still computed and shown on the trend chart. A positive NOI means the location covers all operating costs from its own revenue — but Net Income is the headline profitability metric on the Overview page, since 25N has minimal non-operating activity." },
      { name: "Net Income", formula: "NOI + Other Income − Other Expenses", source: "Computed by build_statements.py", note: "Primary profitability metric shown on the Overview page — NOI is no longer shown alongside it there to avoid presenting two near-identical numbers." },
    ],
  },
  {
    title: "Operating Expenses (OPEX)",
    metrics: [
      { name: "Payroll", formula: "Salaries, wages, benefits, and payroll taxes for location staff", source: "Yardi Scheduler_Reports, accounts 6010–6099" },
      { name: "Facilities", formula: "Rent, CAM charges, insurance, and building maintenance", source: "Yardi Scheduler_Reports, accounts 6200–6399" },
      { name: "Admin / Legal", formula: "Administrative, legal, and professional service fees", source: "Yardi Scheduler_Reports, accounts 6400–6499" },
      { name: "Marketing", formula: "Advertising, promotional, and brand spend", source: "Yardi Scheduler_Reports, accounts 6500–6599" },
      { name: "Technology", formula: "Software subscriptions, IT, and tech infrastructure", source: "Yardi Scheduler_Reports, accounts 6600–6699" },
      { name: "Utilities", formula: "Electricity, gas, water, and internet", source: "Yardi Scheduler_Reports, accounts 6700–6799" },
    ],
  },
  {
    title: "Budget & Variance",
    metrics: [
      { name: "Budget (Full Mo.)", formula: "Full-month budget as entered in Yardi for the period", source: "Yardi Scheduler_Reports — Budget Comparison export" },
      { name: "Budget (X% pace)", formula: "Full-month budget × (days elapsed ÷ days in month)", source: "Computed from upload_at timestamp vs period month", note: "Used when viewing a partial (MTD) period so budget comparisons reflect the same elapsed time, not the full month target." },
      { name: "vs Budget (Δ)", formula: "Actual − Effective Budget", source: "Computed. Green = favorable, Red = unfavorable" },
      { name: "Revenue vs Budget", formula: "Revenue − Full-Month Budget", source: "Never prorated — most revenue is contractual and posts in full on the 1st, so MTD actuals are always compared to the full-month target" },
      { name: "Net Income vs Budget %", formula: "(MTD NI − Prorated NI Budget) ÷ |Prorated NI Budget| × 100", source: "Computed using prorated budget for MTD periods. NI budget is pulled from Yardi's own Net Income total row (account 9900)." },
    ],
  },
  {
    title: "Health Badges",
    metrics: [
      { name: "Green — On Pace", formula: "Net Income is within 10% of prorated budget (i.e., NI actual ≥ NI budget × pacing × 0.90)", source: "Computed in DashboardClient" },
      { name: "Yellow — At Risk", formula: "Net Income is 10–25% below prorated budget", source: "Computed in DashboardClient" },
      { name: "Red — Off Track", formula: "Net Income is more than 25% below prorated budget", source: "Computed in DashboardClient" },
    ],
  },
  {
    title: "Data Pipeline",
    metrics: [
      { name: "Source", formula: "Yardi Property Management — Scheduler_Reports Excel export", source: "Uploaded manually via the dashboard upload flow" },
      { name: "Parsing", formula: "parse_gl.py extracts line items from the 12-Month Statement and Budget Comparison sheets", source: "scripts/month-close/parse_gl.py" },
      { name: "Aggregation", formula: "build_statements.py rolls up accounts into sections (Revenue, COS, GP, OPEX, NOI, NI)", source: "scripts/month-close/build_statements.py using gl_rules.json" },
      { name: "Storage", formula: "Processed JSON stored in Supabase monthly_financials table, keyed by location + month", source: "Supabase project idxuiibqevvbdiluxoth" },
      { name: "Insights", formula: "Claude Haiku generates 3–5 observations per upload based on the processed income statement", source: "Anthropic API — claude-haiku-4-5, ~$0.003/upload" },
    ],
  },
];

export function DataDictionary() {
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors duration-150 cursor-pointer flex items-center gap-1"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 4a1 1 0 110 2 1 1 0 010-2zm0 3a1 1 0 011 1v4a1 1 0 11-2 0V8a1 1 0 011-1z"/>
        </svg>
        Data dictionary & sources
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />
          {/* Drawer */}
          <div className="relative ml-auto w-full max-w-xl bg-white h-full flex flex-col shadow-2xl">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Data Dictionary & Sources</h2>
                <p className="text-xs text-gray-400 mt-0.5">Every metric: formula, source file, and calculation method</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-150 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-1 min-h-0">
              {/* Sidebar nav */}
              <nav className="w-44 flex-shrink-0 border-r border-gray-100 py-3 overflow-y-auto">
                {SECTIONS.map((s, i) => (
                  <button
                    key={s.title}
                    onClick={() => setActiveSection(i)}
                    className={[
                      "w-full text-left px-4 py-2 text-xs font-medium transition-colors duration-100 cursor-pointer",
                      i === activeSection
                        ? "bg-[#fdf2e9] text-[#F15B27] border-r-2 border-[#F15B27]"
                        : "text-gray-500 hover:text-gray-800 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {s.title}
                  </button>
                ))}
              </nav>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">
                  {SECTIONS[activeSection].title}
                </h3>
                <div className="space-y-5">
                  {SECTIONS[activeSection].metrics.map((m) => (
                    <div key={m.name} className="border-b border-gray-50 pb-4 last:border-0">
                      <p className="text-sm font-semibold text-gray-800 mb-1">{m.name}</p>
                      <div className="space-y-1.5">
                        <div>
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Formula</span>
                          <p className="text-xs text-gray-600 mt-0.5">{m.formula}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Source</span>
                          <p className="text-xs text-gray-500 mt-0.5">{m.source}</p>
                        </div>
                        {m.note && (
                          <p className="text-xs text-gray-400 italic bg-gray-50 rounded px-2.5 py-1.5 mt-1">{m.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
