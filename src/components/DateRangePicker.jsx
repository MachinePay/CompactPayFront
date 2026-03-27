import { useEffect, useState } from "react";

export default function DateRangePicker({ value, onChange }) {
  const [start, setStart] = useState(value?.start || "");
  const [end, setEnd] = useState(value?.end || "");

  useEffect(() => {
    setStart(value?.start || "");
    setEnd(value?.end || "");
  }, [value?.start, value?.end]);

  const handleStart = (e) => {
    setStart(e.target.value);
    onChange({ start: e.target.value, end });
  };

  const handleEnd = (e) => {
    setEnd(e.target.value);
    onChange({ start, end: e.target.value });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={start}
        onChange={handleStart}
        className="rounded-full border border-[var(--color-border)] bg-white/92 px-4 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
      />
      <span className="text-sm text-[var(--color-text-soft)]">ate</span>
      <input
        type="date"
        value={end}
        onChange={handleEnd}
        className="rounded-full border border-[var(--color-border)] bg-white/92 px-4 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
      />
    </div>
  );
}
