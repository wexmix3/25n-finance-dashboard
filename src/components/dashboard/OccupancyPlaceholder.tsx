export function OccupancyPlaceholder() {
  return (
    <div className="bg-white rounded-lg border border-dashed border-gray-300 p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Occupancy</h3>
      <p className="text-sm text-gray-400">
        Occupancy data from Kube will appear here once the first export file is provided and the parser is built.
      </p>
    </div>
  );
}
