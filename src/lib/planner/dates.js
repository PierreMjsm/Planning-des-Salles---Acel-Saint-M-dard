import { MONTHS, MONTH_ABBR, WEEKDAYS } from "./constants.js";

const pad = (n) => String(n).padStart(2, "0");
export const toKey = (y, m0, d) => `${y}-${pad(m0 + 1)}-${pad(d)}`;
export function parseKey(k) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export const keyOf = (date) => toKey(date.getFullYear(), date.getMonth(), date.getDate());
export const todayKey = () => keyOf(new Date());
export function addDays(k, n) {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return keyOf(d);
}
export function addMonths(k, n) {
  const d = parseKey(k);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return keyOf(d);
}
export function weekdayIndex(k) {
  const w = parseKey(k).getDay();
  return w === 0 ? 6 : w - 1;
}
export const isWeekend = (k) => weekdayIndex(k) >= 5;
export function schoolYearOf(k) {
  const [y, m] = k.split("-").map(Number);
  return m >= 9 ? y : y - 1;
}
export const yearBounds = (y) => ({ start: `${y}-09-01`, end: `${y + 1}-08-31` });
export const yearLabel = (y) => `${y}-${y + 1}`;
export function monthBounds(k) {
  const d = parseKey(k);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return { start: toKey(d.getFullYear(), d.getMonth(), 1), end: toKey(d.getFullYear(), d.getMonth(), last) };
}
export const weekStart = (k) => addDays(k, -weekdayIndex(k));
export function eachDay(from, to) {
  const out = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard < 4000) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard++;
  }
  return out;
}
export function monthMatrix(k) {
  const { start, end } = monthBounds(k);
  const cells = [];
  for (let i = 0; i < weekdayIndex(start); i++) cells.push(null);
  eachDay(start, end).forEach((d) => cells.push(d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
export function frLong(k) {
  const d = parseKey(k);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export function frDayTitle(k) {
  const w = WEEKDAYS[weekdayIndex(k)];
  return `${w.charAt(0).toUpperCase()}${w.slice(1)} ${frLong(k)}`;
}
export function frShort(k) {
  const d = parseKey(k);
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`;
}
export const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
export function monthTitle(k) {
  const d = parseKey(k);
  return `${capitalize(MONTHS[d.getMonth()])} ${d.getFullYear()}`;
}
