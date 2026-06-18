import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const BRASILIA_TIMEZONE = "America/Sao_Paulo";
const HAS_TIMEZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

export function brasiliaDate(value) {
  if (!value) return dayjs(value);
  if (value instanceof Date || typeof value === "number") {
    return dayjs(value).tz(BRASILIA_TIMEZONE);
  }

  const text = String(value).trim();
  if (!text.includes("T") && !text.includes(" ")) {
    return dayjs(text);
  }

  return (HAS_TIMEZONE.test(text) ? dayjs(text) : dayjs.utc(text)).tz(
    BRASILIA_TIMEZONE,
  );
}

export function nowInBrasilia() {
  return dayjs().tz(BRASILIA_TIMEZONE);
}
