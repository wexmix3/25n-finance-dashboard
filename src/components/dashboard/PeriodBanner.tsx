interface Props {
  currentMonth: string;
  priorMonth: string;
  uploadedAt?: string;
  locked?: boolean;
}

export function PeriodBanner({ currentMonth, priorMonth, uploadedAt, locked }: Props) {
  const uploadLabel = uploadedAt
    ? `as of ${new Date(uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : "no data";

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-6">
        <div>
          <span className="text-sm font-semibold text-gray-900">{currentMonth}</span>
          <span className="ml-2 text-xs text-gray-400">MTD {uploadLabel}</span>
        </div>
        <div className="h-4 w-px bg-gray-200" />
        <div>
          <span className="text-sm font-medium text-gray-500">{priorMonth}</span>
          {locked && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
              Final
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
