// Strict fr-FR formatting. No reliance on Intl (Hermes support is partial).
const NBSP = "\u00A0"; // non-breaking space (before €)
const NARROW = "\u202F"; // narrow no-break space (thousands)

const WEEKDAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** Group thousands with a narrow no-break space: 6 500. */
export function formatNumber(n: number): string {
  const neg = n < 0;
  const s = Math.abs(Math.round(n)).toString();
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += NARROW;
    out += s[i];
  }
  return (neg ? "-" : "") + out;
}

export const formatSteps = (n: number) => formatNumber(n);
export const formatCC = (n: number) => formatNumber(n);

/** Euros from integer cents: "2,50 €" (comma decimal, nbsp before symbol). */
export function formatEuros(cents: number): string {
  const euros = (cents / 100).toFixed(2).replace(".", ",");
  return `${euros}${NBSP}€`;
}

function parseDate(input: string | Date): Date {
  if (input instanceof Date) return input;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(input);
}

/** DD/MM/YYYY */
export function formatDate(input: string | Date): string {
  const d = parseDate(input);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** "lundi 15 juin" (lowercase, weeks start Monday implicitly). */
export function formatDayLabel(input: string | Date): string {
  const d = parseDate(input);
  const wd = (d.getDay() + 6) % 7; // JS Sunday=0 → Monday-first index
  return `${WEEKDAYS[wd]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** 24h time "14:30" from an ISO datetime string. */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** mm:ss countdown from seconds. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** French phone display: 06 12 34 56 78 */
export function formatPhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}
