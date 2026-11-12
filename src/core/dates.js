const PRESETS = {
  short: { day: "numeric", month: "short" },
  numericDate: { day: "2-digit", month: "2-digit", year: "numeric" },
  long: { weekday: "long", day: "numeric", month: "long" },
  today: { weekday: "short", day: "numeric", month: "long" },
  clock: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
  monthYear: { month: "long", year: "numeric" },
  weekdayShort: { weekday: "short" },
};
const formatterCache = new Map();

function localDate(year, monthIndex, day) {
  const date = new Date(0);
  date.setFullYear(year, monthIndex, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatDate(date, locale, preset) {
  if (!Object.hasOwn(PRESETS, preset)) throw new RangeError("Unknown date format.");
  const key = `${locale}|${preset}`;
  if (!formatterCache.has(key))
    formatterCache.set(key, new Intl.DateTimeFormat(locale, PRESETS[preset]));
  const formatter = formatterCache.get(key);
  if (preset === "numericDate") {
    const parts = formatter.formatToParts(date);
    const part = (type) => parts.find((item) => item.type === type).value;
    return `${part("day")}.${part("month")}.${part("year")}`;
  }
  return formatter.format(date);
}

export function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || year > 9999) return false;
  const date = localDate(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function parseLocalDate(value) {
  if (!isValidDate(value)) throw new RangeError("Invalid calendar date.");
  const [year, month, day] = value.split("-").map(Number);
  return localDate(year, month - 1, day);
}

export function getLocalDateString(date = new Date()) {
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date.");
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addDays(value, days) {
  if (!Number.isInteger(days)) throw new RangeError("Days must be a whole number.");
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  const result = getLocalDateString(date);
  if (!isValidDate(result)) throw new RangeError("Date is outside the supported range.");
  return result;
}

export function addMonths(value, months) {
  if (!Number.isInteger(months)) throw new RangeError("Months must be a whole number.");
  const date = parseLocalDate(value);
  const first = localDate(date.getFullYear(), date.getMonth() + months, 1);
  const last = localDate(first.getFullYear(), first.getMonth() + 1, 0);
  const result = getLocalDateString(
    localDate(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), last.getDate())),
  );
  if (!isValidDate(result)) throw new RangeError("Date is outside the supported range.");
  return result;
}

export function getNowTimeString(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function isValidTime(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isTaskOverdue(task, now = new Date()) {
  if (task.completed || !task.dueDate) return false;
  const today = getLocalDateString(now);
  return (
    task.dueDate < today ||
    (task.dueDate === today && Boolean(task.dueTime) && task.dueTime < getNowTimeString(now))
  );
}
