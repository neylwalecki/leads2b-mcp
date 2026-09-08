// Controlled v1 writes returned local UTC-03 wall-clock time without an offset.
// Keep explicit offsets as reported unless the caller supplies a verified source correction.
export function parseApiDate(value: string | undefined, naiveOffset = "-03:00"): number | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replace(" ", "T");
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(normalized)) return undefined;
  const calendarDate = normalized.slice(0, 10);
  const calendarTime = Date.parse(`${calendarDate}T00:00:00Z`);
  if (!Number.isFinite(calendarTime) || new Date(calendarTime).toISOString().slice(0, 10) !== calendarDate) return undefined;
  const text = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(normalized)
    ? `${normalized}${naiveOffset}` : normalized;
  const time = Date.parse(text);
  return Number.isFinite(time) ? time : undefined;
}

export function dateBoundary(value: string, boundary: "start" | "end"): number {
  const time = parseApiDate(value, "Z");
  if (time === undefined) throw new Error("Data inválida; use YYYY-MM-DD ou timestamp ISO 8601.");
  return time + (boundary === "end" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? 86_399_999 : 0);
}

export function inDateRange(value: string | undefined, from?: string, to?: string, apiTimestampOffset?: string): boolean {
  const start = from ? dateBoundary(from, "start") : undefined;
  const end = to ? dateBoundary(to, "end") : undefined;
  if (start !== undefined && end !== undefined && start > end) throw new Error("A data inicial deve anteceder a final.");
  if (start === undefined && end === undefined) return true;
  const adjusted = apiTimestampOffset && value?.endsWith("Z") ? value.slice(0, -1) + apiTimestampOffset : value;
  const time = parseApiDate(adjusted, apiTimestampOffset ?? "-03:00");
  return time !== undefined && (start === undefined || time >= start) && (end === undefined || time <= end);
}
