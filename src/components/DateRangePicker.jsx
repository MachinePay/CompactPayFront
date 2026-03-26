import { useState } from "react";

export default function DateRangePicker({ value, onChange }) {
  const [start, setStart] = useState(value?.start || "");
  const [end, setEnd] = useState(value?.end || "");

  const handleStart = (e) => {
    setStart(e.target.value);
    onChange({ start: e.target.value, end });
  };
  const handleEnd = (e) => {
    setEnd(e.target.value);
    onChange({ start, end: e.target.value });
  };

  return (
    <div className="flex gap-2 items-center">
      <input
        type="date"
        value={start}
        onChange={handleStart}
        className="p-2 rounded bg-bgmain text-white border border-slate-700 focus:outline-primary"
      />
      <span className="text-white">até</span>
      <input
        type="date"
        value={end}
        onChange={handleEnd}
        className="p-2 rounded bg-bgmain text-white border border-slate-700 focus:outline-primary"
      />
    </div>
  );
}
