export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`);
}

export function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(date: Date) {
  const result = startOfDay(date);
  result.setDate(result.getDate() + 1);
  return result;
}

export function getWeekDays(date: Date) {
  const start = startOfDay(date);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return { date: day, dateKey: toDateKey(day) };
  });
}

export function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function addMonths(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(1);
  result.setMonth(result.getMonth() + amount);
  return result;
}

export function formatTime(value: string | Date, locale: string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatDate(value: string | Date, locale: string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatMonth(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function isOnDate(value: string, dateKey: string) {
  return toDateKey(new Date(value)) === dateKey;
}

export function overlaps(
  leftStart: string | Date,
  leftEnd: string | Date,
  rightStart: string | Date,
  rightEnd: string | Date,
) {
  return new Date(leftStart).getTime() < new Date(rightEnd).getTime()
    && new Date(leftEnd).getTime() > new Date(rightStart).getTime();
}

