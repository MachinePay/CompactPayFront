const inputClassName =
  "min-w-0 flex-1 rounded-full border border-[var(--color-border)] bg-white/92 px-4 py-2 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]";

// Com withTime, start/end podem levar a hora junto ("2026-10-19T14:30") -
// o backend aceita os dois formatos. Hora vazia = dia inteiro.
function splitValue(value) {
  const [date = "", time = ""] = (value || "").split("T");
  return { date, time: time.slice(0, 5) };
}

function joinValue(date, time) {
  if (!date) return "";
  return time ? `${date}T${time}` : date;
}

export default function DateRangePicker({ value, onChange, withTime = false }) {
  const start = splitValue(value?.start);
  const end = splitValue(value?.end);

  const update = (nextStart, nextEnd) => {
    onChange({
      start: joinValue(nextStart.date, nextStart.time),
      end: joinValue(nextEnd.date, nextEnd.time),
    });
  };

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
        <input
          type="date"
          value={start.date}
          onChange={(e) => update({ ...start, date: e.target.value }, end)}
          className={`${inputClassName} sm:min-w-[140px]`}
        />
        {withTime ? (
          <input
            type="time"
            value={start.time}
            title="Hora inicial (vazio = 00:00)"
            disabled={!start.date}
            onChange={(e) => update({ ...start, time: e.target.value }, end)}
            className={`${inputClassName} max-w-[118px] disabled:opacity-50`}
          />
        ) : null}
      </div>
      <span className="shrink-0 text-sm text-[var(--color-text-soft)]">ate</span>
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
        <input
          type="date"
          value={end.date}
          onChange={(e) => update(start, { ...end, date: e.target.value })}
          className={`${inputClassName} sm:min-w-[140px]`}
        />
        {withTime ? (
          <input
            type="time"
            value={end.time}
            title="Hora final (vazio = 23:59)"
            disabled={!end.date}
            onChange={(e) => update(start, { ...end, time: e.target.value })}
            className={`${inputClassName} max-w-[118px] disabled:opacity-50`}
          />
        ) : null}
      </div>
    </div>
  );
}
