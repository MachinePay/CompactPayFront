export default function DateRangePicker({ value, onChange }) {
  const start = value?.start || "";
  const end = value?.end || "";

  const handleStart = (e) => {
    onChange({ start: e.target.value, end });
  };

  const handleEnd = (e) => {
    onChange({ start, end: e.target.value });
  };

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
      <input
        type="date"
        value={start}
        onChange={handleStart}
        className="min-w-0 flex-1 rounded-full border border-[var(--color-border)] bg-white/92 px-4 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] sm:min-w-[140px]"
      />
      <span className="shrink-0 text-sm text-[var(--color-text-soft)]">ate</span>
      <input
        type="date"
        value={end}
        onChange={handleEnd}
        className="min-w-0 flex-1 rounded-full border border-[var(--color-border)] bg-white/92 px-4 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] sm:min-w-[140px]"
      />
    </div>
  );
}
