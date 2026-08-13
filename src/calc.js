export const DAY_NAMES_SHORT = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"];
export const MONTH_NAMES = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

export const DEFAULT_SETTINGS = {
  targetDays: 90,
  verdeMin: 120,
  gialloMin: 60,
  categories: [
    { key: "lesing", label: "Lesing / Ilys", sinceDate: null },
    { key: "semplificato", label: "Semplificato", sinceDate: null },
    { key: "tecnico", label: "Tecnico", sinceDate: null },
    { key: "hobby", label: "YT - Podcast / Hobby", sinceDate: null }
  ]
};

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function defaultHabits() {
  return [
    { id: genId(), label: "Ilys Shad / Ass Testo", sinceDate: null },
    { id: genId(), label: "Semplificato", sinceDate: null },
    { id: genId(), label: "Lingua Quot / Hobby", sinceDate: null },
    { id: genId(), label: "Lesing", sinceDate: null },
    { id: genId(), label: "Journaling", sinceDate: null }
  ];
}

export function isoDate(y, m, d) {
  const dt = new Date(y, m, d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function todayStr() {
  const n = new Date();
  return isoDate(n.getFullYear(), n.getMonth(), n.getDate());
}

export function fmtHM(min) {
  min = Math.max(0, Math.round(min || 0));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function dowMon(date) {
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
}

export function fmtDateIt(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = dowMon(first);
  const start = new Date(year, month, 1 - offset);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

/* ---------- Since-date applicability (categories / habits added mid-course) ---------- */

export function isActiveOn(sinceDate, date) {
  return !sinceDate || date >= sinceDate;
}

/* ---------- Page 1 (minuti) ---------- */

export function activeCategoriesFor(settings, date) {
  return settings.categories.filter((c) => isActiveOn(c.sinceDate, date));
}

export function p1Total(entry, settings) {
  return activeCategoriesFor(settings, entry.date).reduce((s, c) => s + (Number(entry.minutes[c.key]) || 0), 0);
}

export function p1Status(total, settings) {
  if (total >= settings.verdeMin) return "verde";
  if (total >= settings.gialloMin) return "giallo";
  return "rosso";
}

export function p1Arrow(status) {
  return status === "verde" ? "\u2714" : status === "giallo" ? "\u25B2" : "\u25BC";
}

export function sortByDate(entries) {
  return [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/* ---------- Page 2 (habit) ---------- */

export function activeHabitsFor(habits, date) {
  return habits.filter((h) => isActiveOn(h.sinceDate, date));
}

export function p2Counts(entry, habits) {
  const active = activeHabitsFor(habits, entry.date);
  let spunte = 0;
  active.forEach((h) => {
    if (entry.checks[h.id]) spunte++;
  });
  return { spunte, saltate: active.length - spunte, total: active.length };
}

export function p2Status(entry, habits) {
  const { spunte, saltate, total } = p2Counts(entry, habits);
  if (total > 0 && spunte === total) return "verde";
  if (saltate <= 1) return "giallo";
  return "rosso";
}

export function p2Icon(status) {
  return status === "verde" ? "\u2714" : status === "giallo" ? "\uD83D\uDFE1" : "\u2717";
}

/* ---------- Streak ---------- */

export function computeStreak(sortedEntries) {
  if (sortedEntries.length === 0) return 0;
  const dates = new Set(sortedEntries.map((e) => e.date));
  const cursor = new Date();
  if (!dates.has(todayStr())) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (true) {
    const ds = isoDate(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    if (dates.has(ds)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}
