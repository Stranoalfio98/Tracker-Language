import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient.js";
import {
  DAY_NAMES_SHORT, MONTH_NAMES, DEFAULT_SETTINGS, defaultHabits, genId,
  isoDate, todayStr, fmtHM, fmtDateIt, buildMonthGrid,
  p1Total, p1Status, p1Arrow, sortByDate,
  p2Counts, p2Status, p2Icon, computeStreak
} from "./calc.js";

/* ============================== DB MAPPERS ============================== */

function minutiFromDb(row) {
  return {
    id: row.id, date: row.date,
    minutes: { lesing: row.lesing || 0, semplificato: row.semplificato || 0, tecnico: row.tecnico || 0, hobby: row.hobby || 0 }
  };
}
function minutiToDb(entry, userId) {
  return {
    user_id: userId, date: entry.date,
    lesing: entry.minutes.lesing || 0, semplificato: entry.minutes.semplificato || 0,
    tecnico: entry.minutes.tecnico || 0, hobby: entry.minutes.hobby || 0
  };
}
function habitEntryFromDb(row) {
  return { id: row.id, date: row.date, checks: row.checks || {} };
}
function habitEntryToDb(entry, userId) {
  return { user_id: userId, date: entry.date, checks: entry.checks };
}
function settingsFromDb(row) {
  return {
    targetDays: row.target_days, verdeMin: row.verde_min, gialloMin: row.giallo_min,
    categories: row.categories || DEFAULT_SETTINGS.categories
  };
}
function settingsToDb(s, userId) {
  return { user_id: userId, target_days: s.targetDays, verde_min: s.verdeMin, giallo_min: s.gialloMin, categories: s.categories };
}

async function fetchOrCreateSettings(userId) {
  const { data, error } = await supabase.from("app_settings").select("*").eq("user_id", userId).maybeSingle();
  if (error) { console.error("fetchSettings", error); return DEFAULT_SETTINGS; }
  if (data) return settingsFromDb(data);
  const row = settingsToDb(DEFAULT_SETTINGS, userId);
  const { data: inserted, error: insErr } = await supabase.from("app_settings").insert(row).select().single();
  if (insErr) { console.error("createSettings", insErr); return DEFAULT_SETTINGS; }
  return settingsFromDb(inserted);
}
async function fetchOrCreateHabits(userId) {
  const { data, error } = await supabase.from("app_habits").select("*").eq("user_id", userId).maybeSingle();
  const fallback = defaultHabits();
  if (error) { console.error("fetchHabits", error); return fallback; }
  if (data) return data.habits || fallback;
  const { data: inserted, error: insErr } = await supabase.from("app_habits").insert({ user_id: userId, habits: fallback }).select().single();
  if (insErr) { console.error("createHabits", insErr); return fallback; }
  return inserted.habits || fallback;
}
async function fetchMinutiEntries(userId) {
  const { data, error } = await supabase.from("minuti_entries").select("*").eq("user_id", userId).order("date", { ascending: true });
  if (error) { console.error("fetchMinuti", error); return []; }
  return data.map(minutiFromDb);
}
async function fetchHabitEntries(userId) {
  const { data, error } = await supabase.from("habit_entries").select("*").eq("user_id", userId).order("date", { ascending: true });
  if (error) { console.error("fetchHabitEntries", error); return []; }
  return data.map(habitEntryFromDb);
}

/* ============================== ICONS ============================== */

const Icon = {
  pencil: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>,
  trash: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>,
  x: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>,
  plus: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>,
  gear: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" /></svg>,
  chevL: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>,
  chevR: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>,
  logout: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>,
  mountain: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21 L9 9 L13 15 L17 6 L21 21 Z" /></svg>,
  sun: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>,
  moon: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" /></svg>
};

/* ============================== TOAST ============================== */

function Toast({ toast }) {
  if (!toast) return null;
  return <div className={`toast ${toast.type}`}>{toast.type === "success" ? "\u2714" : "\u26A0"} {toast.message}</div>;
}

/* ============================== CONFIRM MODAL ============================== */

function ConfirmModal({ data, onCancel, onConfirm }) {
  if (!data) return null;
  return (
    <div className="backdrop center" onClick={onCancel}>
      <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
        <h4>{data.title}</h4>
        <p>{data.message}</p>
        <div className="confirm-actions">
          <button className="btn" onClick={onCancel}>Annulla</button>
          <button className="btn danger" onClick={onConfirm}>Elimina</button>
        </div>
      </div>
    </div>
  );
}

/* ============================== RIDGE CHART ============================== */

function RidgeChart({ entries, settings, dark }) {
  const sorted = sortByDate(entries);
  if (sorted.length === 0) {
    return <div className="ridge-empty">Registra la tua prima giornata per veder crescere il profilo del percorso.</div>;
  }
  const palette = dark
    ? { verde: "#4FD1AE", giallo: "#F0B429", rosso: "#F0645A", line: "#8B90A3", dotStroke: "#1B1E26", label: "#8B90A3" }
    : { verde: "#5F8F6B", giallo: "#C1893A", rosso: "#B0472F", line: "#2F4B3C", dotStroke: "#F8F6EF", label: "#666C5D" };
  const stepX = 34, padL = 18, padR = 18, h = 120, padTop = 14, padBottom = 26;
  const w = padL + padR + Math.max(0, sorted.length - 1) * stepX + 10;
  const maxVal = Math.max(settings.verdeMin, ...sorted.map((e) => p1Total(e, settings)));
  const usableH = h - padTop - padBottom;
  const colorFor = (s) => (s === "verde" ? palette.verde : s === "giallo" ? palette.giallo : palette.rosso);

  const pts = sorted.map((e, i) => {
    const total = p1Total(e, settings);
    const status = p1Status(total, settings);
    const x = padL + i * stepX;
    const y = padTop + (usableH - (total / maxVal) * usableH);
    return { x, y, total, status, date: e.date };
  });

  const linePath = pts.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ");
  const areaPath = linePath + ` L${pts[pts.length - 1].x.toFixed(1)},${(h - padBottom).toFixed(1)} L${pts[0].x.toFixed(1)},${(h - padBottom).toFixed(1)} Z`;
  const showEvery = pts.length > 16 ? Math.ceil(pts.length / 16) : 1;

  return (
    <div className="ridge-wrap">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <defs>
          <linearGradient id="ridgeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.verde} stopOpacity="0.28" />
            <stop offset="100%" stopColor={palette.verde} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#ridgeFill)" />
        <path d={linePath} fill="none" stroke={palette.line} strokeWidth="1.6" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4.2" fill={colorFor(p.status)} stroke={palette.dotStroke} strokeWidth="1.4">
            <title>{fmtDateIt(p.date)} — {p.total} min</title>
          </circle>
        ))}
        {pts.map((p, i) => (i % showEvery === 0 ? (
          <text key={"t" + i} x={p.x} y={h - 8} fontSize="8.5" fill={palette.label} textAnchor="middle" fontFamily="JetBrains Mono, monospace">{i + 1}</text>
        ) : null))}
      </svg>
    </div>
  );
}

/* ============================== CALENDAR ============================== */

function MiniCalendar({ cursor, setCursor, entries, statusFn }) {
  const year = cursor.getFullYear(), mo = cursor.getMonth();
  const cells = useMemo(() => buildMonthGrid(year, mo), [year, mo]);
  const byDate = useMemo(() => {
    const m = {};
    entries.forEach((e) => { m[e.date] = e; });
    return m;
  }, [entries]);
  const earliest = entries.length ? entries.reduce((m, e) => (e.date < m ? e.date : m), entries[0].date) : null;
  const today = todayStr();

  return (
    <div>
      <div className="cal-nav">
        <button className="icon-btn" onClick={() => setCursor(new Date(year, mo - 1, 1))}><Icon.chevL width={14} height={14} /></button>
        <span className="cal-title">{MONTH_NAMES[mo]} {year}</span>
        <button className="icon-btn" onClick={() => setCursor(new Date(year, mo + 1, 1))}><Icon.chevR width={14} height={14} /></button>
      </div>
      <div className="cal-grid">
        {DAY_NAMES_SHORT.map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {cells.map((d, i) => {
          const ds = isoDate(d.getFullYear(), d.getMonth(), d.getDate());
          const inMonth = d.getMonth() === mo;
          const entry = byDate[ds];
          let cls = "", tag = "";
          if (entry) {
            const st = statusFn(entry);
            cls = st;
            tag = st === "verde" ? "OK" : st === "giallo" ? "~" : "!";
          } else if (ds > today || !earliest || ds < earliest) {
            cls = "future";
          } else if (ds === today) {
            cls = "pending"; tag = "oggi";
          } else {
            cls = "skipped"; tag = "salt.";
          }
          return (
            <div key={i} className={`cal-cell ${inMonth ? "" : "outside"} ${cls} ${ds === today ? "today" : ""}`}>
              <div className="d">{d.getDate()}</div>
              {tag && <div className="tag">{tag}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== STAT CARD ============================== */

function StatCard({ label, value, tone }) {
  return (
    <div className="stat-card">
      <div className="l">{label}</div>
      <div className={`v ${tone || ""}`}>{value}</div>
    </div>
  );
}

/* ============================== PAGE 1 — MINUTI ============================== */

function Page1({ entries, settings, upsertEntry, deleteEntry, askConfirm, dark }) {
  const [cursor, setCursor] = useState(new Date());
  const [editingId, setEditingId] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [minutes, setMinutes] = useState({});
  const formRef = useRef(null);

  const sorted = useMemo(() => sortByDate(entries), [entries]);
  const ascendingIds = sorted.map((e) => e.id);

  useEffect(() => {
    if (editingId) {
      const e = entries.find((x) => x.id === editingId);
      if (e) { setDate(e.date); setMinutes({ ...e.minutes }); }
    } else {
      setDate(todayStr()); setMinutes({});
    }
  }, [editingId]); // eslint-disable-line

  function updateMin(key, val) {
    setMinutes((m) => ({ ...m, [key]: Math.max(0, Number(val) || 0) }));
  }

  const previewTotal = settings.categories.reduce((s, c) => s + (Number(minutes[c.key]) || 0), 0);
  const previewStatus = p1Status(previewTotal, settings);

  function submit() {
    if (!date) return;
    const fullMinutes = {};
    settings.categories.forEach((c) => { fullMinutes[c.key] = Number(minutes[c.key]) || 0; });
    let targetId = editingId;
    if (!targetId) {
      const dup = entries.find((e) => e.date === date);
      if (dup) targetId = dup.id;
    }
    upsertEntry({ id: targetId, date, minutes: fullMinutes });
    setEditingId(null);
  }

  const totalMin = sorted.reduce((s, e) => s + p1Total(e, settings), 0);
  const avg = sorted.length ? totalMin / sorted.length : 0;
  const verdeCount = sorted.filter((e) => p1Status(p1Total(e, settings), settings) === "verde").length;
  const rossoCount = sorted.filter((e) => p1Status(p1Total(e, settings), settings) === "rosso").length;
  const best = sorted.reduce((m, e) => Math.max(m, p1Total(e, settings)), 0);

  return (
    <div>
      <div className="stat-row">
        <StatCard label="Giorni registrati" value={sorted.length} />
        <StatCard label="Totale minuti" value={totalMin} />
        <StatCard label="Media giornaliera" value={fmtHM(avg)} />
        <StatCard label="Miglior giornata" value={fmtHM(best)} />
        <StatCard label="Giorni Verdi" value={verdeCount} tone="verde" />
        <StatCard label="Giorni Rossi" value={rossoCount} tone="rosso" />
      </div>

      <div className="section">
        <div className="section-head"><div><span className="eyebrow">Profilo del percorso</span><h3>Andamento minuti per giorno</h3></div></div>
        <RidgeChart entries={entries} settings={settings} dark={dark} />
        <div className="ridge-legend">
          <span><i style={{ background: "var(--moss)" }}></i>Verde — obiettivo raggiunto</span>
          <span><i style={{ background: "var(--amber)" }}></i>Giallo — in progresso</span>
          <span><i style={{ background: "var(--rust)" }}></i>Rosso — sotto soglia</span>
        </div>
      </div>

      <div className="section">
        <div className="section-head"><div><span className="eyebrow">Calendario</span><h3>Registro giornaliero</h3></div></div>
        <MiniCalendar cursor={cursor} setCursor={setCursor} entries={entries} statusFn={(e) => p1Status(p1Total(e, settings), settings)} />
      </div>

      <div className="section" ref={formRef}>
        <div className="section-head"><div><span className="eyebrow">{editingId ? "Modifica voce" : "Nuova voce"}</span><h3>{editingId ? "Modifica la giornata" : "Registra la giornata"}</h3></div></div>
        <div className="form-grid">
          <label className="field"><span>Data</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          {settings.categories.map((c) => (
            <label className="field" key={c.key}><span>{c.label}</span>
              <input type="number" min="0" step="5" placeholder="0" value={minutes[c.key] ?? ""} onChange={(e) => updateMin(c.key, e.target.value)} />
            </label>
          ))}
        </div>
        <div className="form-preview">
          <div className="pv-item"><span className="dim" style={{ fontSize: 10.5, textTransform: "uppercase" }}>Totale</span><span className="n mono">{previewTotal} min</span></div>
          <div className="pv-item"><span className="dim" style={{ fontSize: 10.5, textTransform: "uppercase" }}>Ore</span><span className="n mono">{fmtHM(previewTotal)}</span></div>
          <div className="pv-item"><span className="dim" style={{ fontSize: 10.5, textTransform: "uppercase" }}>Semaforo</span><span className={`badge ${previewStatus}`}>{previewStatus[0].toUpperCase() + previewStatus.slice(1)}</span></div>
        </div>
        <div className="form-actions">
          <button className="btn primary" onClick={submit}>{editingId ? "Salva Modifiche" : "Aggiungi Giornata"}</button>
          {editingId && <button className="btn ghost" onClick={() => setEditingId(null)}>Annulla modifica</button>}
        </div>
      </div>

      <div className="section">
        <div className="section-head"><div><span className="eyebrow">Registro</span><h3>Tutte le giornate</h3></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Giorno</th><th>Road to {settings.targetDays}</th><th>Data</th>
              {settings.categories.map((c) => <th key={c.key}>{c.label}</th>)}
              <th>Tot. Minuti</th><th>Tot. Ore</th><th>Semaforo</th><th>Habit Tracker</th><th></th>
            </tr></thead>
            <tbody>
              {sorted.length === 0 && <tr><td colSpan={5 + settings.categories.length} className="empty-row">Nessuna giornata registrata ancora.</td></tr>}
              {[...sorted].reverse().map((e) => {
                const dayNum = ascendingIds.indexOf(e.id) + 1;
                const total = p1Total(e, settings);
                const status = p1Status(total, settings);
                return (
                  <tr key={e.id}>
                    <td className="mono">{dayNum}</td>
                    <td className="mono dim">{dayNum}/{settings.targetDays}</td>
                    <td className="mono">{fmtDateIt(e.date)}</td>
                    {settings.categories.map((c) => <td className="mono" key={c.key}>{e.minutes[c.key] || 0}</td>)}
                    <td className="mono">{total}</td>
                    <td className="mono">{fmtHM(total)}</td>
                    <td><span className={`badge ${status}`}>{status[0].toUpperCase() + status.slice(1)}</span></td>
                    <td style={{ fontSize: 15 }}>{p1Arrow(status)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn" onClick={() => { setEditingId(e.id); formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }}><Icon.pencil width={12} height={12} /></button>
                        <button className="icon-btn danger" onClick={() => askConfirm({
                          title: "Eliminare questa giornata?",
                          message: "La voce verrà rimossa definitivamente dal registro minuti.",
                          onConfirm: () => { deleteEntry(e.id); if (editingId === e.id) setEditingId(null); }
                        })}><Icon.trash width={12} height={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============================== PAGE 2 — HABIT TRACKER ============================== */

function Page2({ entries, habits, upsertEntry, deleteEntry, askConfirm }) {
  const [cursor, setCursor] = useState(new Date());
  const [editingId, setEditingId] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [draft, setDraft] = useState({});
  const formRef = useRef(null);

  const sorted = useMemo(() => sortByDate(entries), [entries]);
  const ascendingIds = sorted.map((e) => e.id);

  useEffect(() => {
    if (editingId) {
      const e = entries.find((x) => x.id === editingId);
      if (e) { setDate(e.date); setDraft({ ...e.checks }); }
    } else {
      setDate(todayStr()); setDraft({});
    }
  }, [editingId]); // eslint-disable-line

  function toggle(id) { setDraft((d) => ({ ...d, [id]: !d[id] })); }
  function markAll() { const d = {}; habits.forEach((h) => { d[h.id] = true; }); setDraft(d); }

  let previewSpunte = 0; habits.forEach((h) => { if (draft[h.id]) previewSpunte++; });
  const previewSaltate = habits.length - previewSpunte;
  const previewStatus = habits.length > 0 && previewSpunte === habits.length ? "verde" : previewSaltate <= 1 ? "giallo" : "rosso";

  function submit() {
    if (!date) return;
    const checks = { ...draft };
    habits.forEach((h) => { if (checks[h.id] === undefined) checks[h.id] = false; });
    let targetId = editingId;
    if (!targetId) {
      const dup = entries.find((e) => e.date === date);
      if (dup) targetId = dup.id;
    }
    upsertEntry({ id: targetId, date, checks });
    setEditingId(null);
  }

  const totalSpunte = sorted.reduce((s, e) => s + p2Counts(e, habits).spunte, 0);
  const avgSpunte = sorted.length ? totalSpunte / sorted.length : 0;
  const perfectDays = sorted.filter((e) => p2Status(e, habits) === "verde").length;
  const rossoDays = sorted.filter((e) => p2Status(e, habits) === "rosso").length;

  return (
    <div>
      <div className="stat-row">
        <StatCard label="Giorni tracciati" value={sorted.length} />
        <StatCard label="Media spunte" value={`${avgSpunte.toFixed(1)} / ${habits.length}`} />
        <StatCard label="Giorni perfetti" value={perfectDays} tone="verde" />
        <StatCard label="Giorni critici" value={rossoDays} tone="rosso" />
      </div>

      <div className="section">
        <div className="section-head"><div><span className="eyebrow">Calendario</span><h3>Le tue tappe</h3></div></div>
        <MiniCalendar cursor={cursor} setCursor={setCursor} entries={entries} statusFn={(e) => p2Status(e, habits)} />
      </div>

      <div className="section" ref={formRef}>
        <div className="section-head">
          <div><span className="eyebrow">{editingId ? "Modifica voce" : "Nuova voce"}</span><h3>{editingId ? "Modifica la giornata" : "Timbra la giornata"}</h3></div>
          <button className="btn ghost" onClick={markAll}>Segna tutte ✔</button>
        </div>
        <label className="field" style={{ maxWidth: 220, marginBottom: 14 }}><span>Data</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        {habits.length === 0 ? (
          <div className="dim">Aggiungi almeno un habit dalle Impostazioni.</div>
        ) : (
          <div className="chip-grid">
            {habits.map((h) => {
              const on = !!draft[h.id];
              return (
                <div key={h.id} className={`chip-toggle ${on ? "on" : ""}`} onClick={() => toggle(h.id)}>
                  <span>{h.label}</span><span className="mark">{on ? "✔" : "✗"}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="form-preview">
          <div className="pv-item"><span className="dim" style={{ fontSize: 10.5, textTransform: "uppercase" }}>Spunte ✔</span><span className="n mono">{previewSpunte}</span></div>
          <div className="pv-item"><span className="dim" style={{ fontSize: 10.5, textTransform: "uppercase" }}>Saltate ✗</span><span className="n mono">{previewSaltate}</span></div>
          <div className="pv-item"><span className="dim" style={{ fontSize: 10.5, textTransform: "uppercase" }}>Habit Tracker</span><span style={{ fontSize: 16 }}>{p2Icon(previewStatus)}</span></div>
        </div>
        <div className="form-actions">
          <button className="btn primary" onClick={submit}>{editingId ? "Salva Modifiche" : "Aggiungi Giornata"}</button>
          {editingId && <button className="btn ghost" onClick={() => setEditingId(null)}>Annulla modifica</button>}
        </div>
      </div>

      <div className="section">
        <div className="section-head"><div><span className="eyebrow">Registro</span><h3>Tutte le giornate</h3></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Giorno</th><th>Data</th>
              {habits.map((h) => <th key={h.id}>{h.label}</th>)}
              <th>Spunte ✔</th><th>Saltate ✗</th><th>Habit Tracker</th><th></th>
            </tr></thead>
            <tbody>
              {sorted.length === 0 && <tr><td colSpan={5 + habits.length} className="empty-row">Nessuna giornata registrata ancora.</td></tr>}
              {[...sorted].reverse().map((e) => {
                const dayNum = ascendingIds.indexOf(e.id) + 1;
                const { spunte, saltate } = p2Counts(e, habits);
                const status = p2Status(e, habits);
                return (
                  <tr key={e.id}>
                    <td className="mono">{dayNum}</td>
                    <td className="mono">{fmtDateIt(e.date)}</td>
                    {habits.map((h) => (
                      <td key={h.id} className={`mini-check ${e.checks[h.id] ? "on" : "off"}`}>{e.checks[h.id] ? "✔" : "✗"}</td>
                    ))}
                    <td className="mono">{spunte}</td>
                    <td className="mono">{saltate}</td>
                    <td style={{ fontSize: 15 }}>{p2Icon(status)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn" onClick={() => { setEditingId(e.id); formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }}><Icon.pencil width={12} height={12} /></button>
                        <button className="icon-btn danger" onClick={() => askConfirm({
                          title: "Eliminare questa giornata?",
                          message: "La voce verrà rimossa definitivamente dall'habit tracker.",
                          onConfirm: () => { deleteEntry(e.id); if (editingId === e.id) setEditingId(null); }
                        })}><Icon.trash width={12} height={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============================== SETTINGS DRAWER ============================== */

function SettingsDrawer({ open, onClose, settings, setSettings, habits, setHabits, saveSettings, saveHabits }) {
  const [local, setLocal] = useState(settings);
  const [localHabits, setLocalHabits] = useState(habits);
  const [newHabit, setNewHabit] = useState("");

  useEffect(() => { if (open) { setLocal(settings); setLocalHabits(habits); } }, [open]); // eslint-disable-line

  if (!open) return null;

  function updateCategoryLabel(idx, val) {
    setLocal((s) => {
      const cats = [...s.categories];
      cats[idx] = { ...cats[idx], label: val };
      return { ...s, categories: cats };
    });
  }
  function addHabit() {
    const v = newHabit.trim();
    if (!v) return;
    setLocalHabits((h) => [...h, { id: genId(), label: v }]);
    setNewHabit("");
  }
  function removeHabit(id) { setLocalHabits((h) => h.filter((x) => x.id !== id)); }
  function renameHabit(id, val) { setLocalHabits((h) => h.map((x) => (x.id === id ? { ...x, label: val } : x))); }

  async function save() {
    setSettings(local);
    setHabits(localHabits);
    await saveSettings(local);
    await saveHabits(localHabits);
    onClose();
  }

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn drawer-close" onClick={onClose}><Icon.x width={14} height={14} /></button>
        <h3>Impostazioni</h3>

        <div className="drawer-section">
          <h4>Percorso</h4>
          <label className="field" style={{ marginBottom: 10 }}><span>Obiettivo giorni (Road to N)</span>
            <input type="number" value={local.targetDays} onChange={(e) => setLocal((s) => ({ ...s, targetDays: Math.max(1, Number(e.target.value) || 90) }))} />
          </label>
          <label className="field" style={{ marginBottom: 10 }}><span>Soglia Verde — da (minuti)</span>
            <input type="number" value={local.verdeMin} onChange={(e) => setLocal((s) => ({ ...s, verdeMin: Math.max(0, Number(e.target.value) || 0) }))} />
          </label>
          <label className="field" style={{ marginBottom: 6 }}><span>Soglia Giallo — da (minuti)</span>
            <input type="number" value={local.gialloMin} onChange={(e) => setLocal((s) => ({ ...s, gialloMin: Math.max(0, Number(e.target.value) || 0) }))} />
          </label>
          <div className="dim" style={{ fontSize: 11, lineHeight: 1.5 }}>Sotto la Soglia Giallo la giornata è sempre Rossa.</div>
        </div>

        <div className="drawer-section">
          <h4>Categorie minuti</h4>
          {local.categories.map((c, i) => (
            <label className="field" style={{ marginBottom: 9 }} key={c.key}><span>{c.key}</span>
              <input type="text" value={c.label} onChange={(e) => updateCategoryLabel(i, e.target.value)} />
            </label>
          ))}
        </div>

        <div className="drawer-section" style={{ borderBottom: "none" }}>
          <h4>Habit list</h4>
          {localHabits.length === 0 && <div className="dim" style={{ fontSize: 12 }}>Nessun habit configurato.</div>}
          {localHabits.map((h) => (
            <div className="habit-edit-row" key={h.id}>
              <input type="text" value={h.label} onChange={(e) => renameHabit(h.id, e.target.value)} />
              <button className="icon-btn danger" onClick={() => removeHabit(h.id)}><Icon.trash width={12} height={12} /></button>
            </div>
          ))}
          <div className="habit-edit-row" style={{ marginTop: 8 }}>
            <input type="text" placeholder="Nuovo habit..." value={newHabit} onChange={(e) => setNewHabit(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addHabit(); }} />
            <button className="icon-btn" onClick={addHabit}><Icon.plus width={14} height={14} /></button>
          </div>
        </div>

        <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={save}>Salva Impostazioni</button>
      </div>
    </div>
  );
}

/* ============================== LOGIN SCREEN ============================== */

function LoginScreen({ recoveryMode }) {
  const [mode, setMode] = useState(recoveryMode ? "reset" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (recoveryMode) setMode("reset"); }, [recoveryMode]);

  async function handleLogin(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError("Email o password non corrette.");
  }
  async function handleSignUp(e) {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) setError(error.message || "Non sono riuscito a creare l'account.");
    else setInfo("Account creato! Controlla la posta per confermare l'indirizzo, poi accedi.");
  }
  async function handleForgot(e) {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setLoading(false);
    if (error) setError("Non sono riuscito a inviare l'email. Riprova.");
    else setInfo("Email inviata! Controlla la posta e clicca il link per impostare una nuova password.");
  }
  async function handleReset(e) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) { setError("La password deve avere almeno 6 caratteri."); return; }
    if (newPassword !== newPassword2) { setError("Le due password non coincidono."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) { setError("Non sono riuscito ad aggiornare la password. Riprova."); return; }
    setInfo("Password aggiornata! Ora puoi accedere.");
    setTimeout(() => { window.location.href = window.location.origin; }, 1500);
  }

  return (
    <div className="login-screen">
      <div className="login-left">
        <div className="login-brand-row">
          <div className="login-mark"><img src="/icon.png" alt="Tracker Language" className="login-mark-img" /></div>
          <span className="brand-wordmark">Tracker <span className="b2">Language</span></span>
        </div>
        <div className="login-hero">
          <h1>Ogni giorno<br /><span>una tappa.</span></h1>
          <p>Minuti di studio, letture, hobby e le tue abitudini quotidiane — un unico diario che non lascia passare un giorno saltato senza dirtelo.</p>
        </div>
      </div>
      <div className="login-right">
        <div className="login-card">
          <div className="login-card-eyebrow">Accesso sicuro</div>
          {mode === "login" && (<>
            <h1>Bentornato</h1><p>Accedi con le tue credenziali</p>
            <form onSubmit={handleLogin} className="login-form">
              <label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
              <label className="field"><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
              <button type="button" className="link-btn" onClick={() => { setMode("forgot"); setError(""); setInfo(""); }}>Password dimenticata?</button>
              {error && <div className="form-error">{error}</div>}
              <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} disabled={loading}>{loading ? "Accesso..." : "Accedi"}</button>
              <button type="button" className="link-btn" style={{ marginTop: 10 }} onClick={() => { setMode("signup"); setError(""); setInfo(""); }}>Non hai un account? Registrati</button>
            </form>
          </>)}
          {mode === "signup" && (<>
            <h1>Crea account</h1><p>Registrati per iniziare il tuo percorso</p>
            <form onSubmit={handleSignUp} className="login-form">
              <label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
              <label className="field"><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
              {error && <div className="form-error">{error}</div>}
              {info && <div className="form-info">{info}</div>}
              <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} disabled={loading}>{loading ? "Creazione..." : "Crea account"}</button>
              <button type="button" className="link-btn" style={{ marginTop: 10 }} onClick={() => { setMode("login"); setError(""); setInfo(""); }}>← Torna al login</button>
            </form>
          </>)}
          {mode === "forgot" && (<>
            <h1>Recupera accesso</h1><p>Ti mandiamo un link per reimpostare la password</p>
            <form onSubmit={handleForgot} className="login-form">
              <label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
              {error && <div className="form-error">{error}</div>}
              {info && <div className="form-info">{info}</div>}
              <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} disabled={loading}>{loading ? "Invio..." : "Invia link di reset"}</button>
              <button type="button" className="link-btn" style={{ marginTop: 10 }} onClick={() => { setMode("login"); setError(""); setInfo(""); }}>← Torna al login</button>
            </form>
          </>)}
          {mode === "reset" && (<>
            <h1>Nuova password</h1><p>Imposta la tua nuova password</p>
            <form onSubmit={handleReset} className="login-form">
              <label className="field"><span>Nuova password</span><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" /></label>
              <label className="field"><span>Conferma password</span><input type="password" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} autoComplete="new-password" /></label>
              {error && <div className="form-error">{error}</div>}
              {info && <div className="form-info">{info}</div>}
              <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} disabled={loading}>{loading ? "Salvataggio..." : "Salva nuova password"}</button>
            </form>
          </>)}
        </div>
      </div>
    </div>
  );
}

/* ============================== APP ROOT ============================== */

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [session, setSession] = useState(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [habits, setHabits] = useState([]);
  const [minutiEntries, setMinutiEntries] = useState([]);
  const [habitEntries, setHabitEntries] = useState([]);

  const [tab, setTab] = useState("page1");
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("rl_theme") || "light"; } catch { return "light"; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("rl_theme", theme); } catch { /* ignore */ }
  }, [theme]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmData, setConfirmData] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((type, message) => {
    clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthChecked(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession((prev) => {
        if (prev && newSession && prev.user.id === newSession.user.id && event !== "PASSWORD_RECOVERY") return prev;
        return newSession;
      });
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      if (!newSession) setLoaded(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      setLoaded(false);
      const userId = session.user.id;
      const [s, h, me, he] = await Promise.all([
        fetchOrCreateSettings(userId), fetchOrCreateHabits(userId),
        fetchMinutiEntries(userId), fetchHabitEntries(userId)
      ]);
      setSettings(s); setHabits(h); setMinutiEntries(me); setHabitEntries(he);
      setLoaded(true);
    })();
  }, [session]);

  const askConfirm = useCallback((data) => setConfirmData(data), []);
  const closeConfirm = useCallback(() => setConfirmData(null), []);
  const confirmAndRun = useCallback(() => {
    if (confirmData?.onConfirm) confirmData.onConfirm();
    setConfirmData(null);
  }, [confirmData]);

  const upsertMinuti = useCallback(async (payload) => {
    try {
      const userId = session.user.id;
      const row = minutiToDb(payload, userId);
      if (payload.id) {
        const { data, error } = await supabase.from("minuti_entries").update(row).eq("id", payload.id).select().single();
        if (error) throw error;
        setMinutiEntries((es) => es.map((e) => (e.id === payload.id ? minutiFromDb(data) : e)));
      } else {
        const { data, error } = await supabase.from("minuti_entries").insert(row).select().single();
        if (error) throw error;
        setMinutiEntries((es) => [...es, minutiFromDb(data)]);
      }
      showToast("success", "Giornata salvata");
    } catch (e) { console.error(e); showToast("error", "Salvataggio non riuscito"); }
  }, [session, showToast]);

  const deleteMinuti = useCallback(async (id) => {
    try {
      const { error } = await supabase.from("minuti_entries").delete().eq("id", id);
      if (error) throw error;
      setMinutiEntries((es) => es.filter((e) => e.id !== id));
      showToast("success", "Giornata eliminata");
    } catch (e) { console.error(e); showToast("error", "Eliminazione non riuscita"); }
  }, [showToast]);

  const upsertHabitEntry = useCallback(async (payload) => {
    try {
      const userId = session.user.id;
      const row = habitEntryToDb(payload, userId);
      if (payload.id) {
        const { data, error } = await supabase.from("habit_entries").update(row).eq("id", payload.id).select().single();
        if (error) throw error;
        setHabitEntries((es) => es.map((e) => (e.id === payload.id ? habitEntryFromDb(data) : e)));
      } else {
        const { data, error } = await supabase.from("habit_entries").insert(row).select().single();
        if (error) throw error;
        setHabitEntries((es) => [...es, habitEntryFromDb(data)]);
      }
      showToast("success", "Giornata salvata");
    } catch (e) { console.error(e); showToast("error", "Salvataggio non riuscito"); }
  }, [session, showToast]);

  const deleteHabitEntry = useCallback(async (id) => {
    try {
      const { error } = await supabase.from("habit_entries").delete().eq("id", id);
      if (error) throw error;
      setHabitEntries((es) => es.filter((e) => e.id !== id));
      showToast("success", "Giornata eliminata");
    } catch (e) { console.error(e); showToast("error", "Eliminazione non riuscita"); }
  }, [showToast]);

  const saveSettingsToDb = useCallback(async (s) => {
    try {
      const { error } = await supabase.from("app_settings").upsert(settingsToDb(s, session.user.id));
      if (error) throw error;
      showToast("success", "Impostazioni salvate");
    } catch (e) { console.error(e); showToast("error", "Impostazioni non salvate"); }
  }, [session, showToast]);

  const saveHabitsToDb = useCallback(async (h) => {
    try {
      const { error } = await supabase.from("app_habits").upsert({ user_id: session.user.id, habits: h });
      if (error) throw error;
    } catch (e) { console.error(e); showToast("error", "Habit non salvati"); }
  }, [session, showToast]);

  const sortedMinuti = useMemo(() => sortByDate(minutiEntries), [minutiEntries]);
  const sortedHabits = useMemo(() => sortByDate(habitEntries), [habitEntries]);
  const progressPct = Math.min(100, Math.round((sortedMinuti.length / settings.targetDays) * 100));
  const streak1 = computeStreak(sortedMinuti);
  const streak2 = computeStreak(sortedHabits);
  const totalMin = sortedMinuti.reduce((s, e) => s + p1Total(e, settings), 0);
  const avgMin = sortedMinuti.length ? Math.round(totalMin / sortedMinuti.length) : 0;

  if (!authChecked) return <div className="app-loading"><div className="spin" /></div>;
  if (recoveryMode) return <><style>{CSS}</style><LoginScreen recoveryMode /></>;
  if (!session) return <><style>{CSS}</style><LoginScreen /></>;
  if (!loaded) return <><style>{CSS}</style><div className="app-loading"><div className="spin" /></div></>;

  return (
    <div id="app">
      <style>{CSS}</style>

      <div className="hero">
        <div className="hero-top">
          <div className="hero-brand">
            <div className="hero-mark"><img src="/icon.png" alt="Tracker Language" className="hero-mark-img" /></div>
            <div><h1>Tracker Language</h1><div className="sub">Diario dei minuti &amp; habit tracker</div></div>
          </div>
          <div className="hero-actions">
            <button className="icon-btn-hero" title={theme === "dark" ? "Passa al tema chiaro" : "Passa al tema scuro"} onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
              {theme === "dark" ? <Icon.sun width={16} height={16} /> : <Icon.moon width={16} height={16} />}
            </button>
            <button className="icon-btn-hero" title="Impostazioni" onClick={() => setSettingsOpen(true)}><Icon.gear width={16} height={16} /></button>
            <button className="icon-btn-hero" title="Esci" onClick={() => supabase.auth.signOut()}><Icon.logout width={16} height={16} /></button>
          </div>
        </div>
        <div className="hero-progress">
          <div className="hero-progress-row">
            <span className="hero-progress-label">Traguardo dei {settings.targetDays} giorni</span>
            <span className="hero-progress-value mono">{sortedMinuti.length} / {settings.targetDays}</span>
          </div>
          <div className="hero-track"><div className="hero-fill" style={{ width: progressPct + "%" }} /></div>
        </div>
        <div className="hero-stats">
          <div className="hero-stat"><div className="n">{streak1}</div><div className="l">Streak minuti</div></div>
          <div className="hero-stat"><div className="n">{streak2}</div><div className="l">Streak habit</div></div>
          <div className="hero-stat"><div className="n">{fmtHM(avgMin)}</div><div className="l">Media / giorno</div></div>
          <div className="hero-stat"><div className="n">{sortedHabits.length}</div><div className="l">Giorni habit</div></div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === "page1" ? "active" : ""}`} onClick={() => setTab("page1")}><span className="tab-num">1</span> Minuti Giornalieri</button>
        <button className={`tab-btn ${tab === "page2" ? "active" : ""}`} onClick={() => setTab("page2")}><span className="tab-num">2</span> Habit Tracker</button>
      </div>

      {tab === "page1"
        ? <Page1 entries={minutiEntries} settings={settings} upsertEntry={upsertMinuti} deleteEntry={deleteMinuti} askConfirm={askConfirm} dark={theme === "dark"} />
        : <Page2 entries={habitEntries} habits={habits} upsertEntry={upsertHabitEntry} deleteEntry={deleteHabitEntry} askConfirm={askConfirm} />
      }

      <SettingsDrawer
        open={settingsOpen} onClose={() => setSettingsOpen(false)}
        settings={settings} setSettings={setSettings} habits={habits} setHabits={setHabits}
        saveSettings={saveSettingsToDb} saveHabits={saveHabitsToDb}
      />
      <ConfirmModal data={confirmData} onCancel={closeConfirm} onConfirm={confirmAndRun} />
      <Toast toast={toast} />
    </div>
  );
}

/* ============================== CSS ============================== */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bitter:wght@500;600;700;800&family=Work+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;}
html,body{margin:0;padding:0;background:#EDEAE0;}
:root{
  --stone:#EDEAE0;--panel:#F8F6EF;--panel-alt:#F1EEE3;--ink:#232A22;--ink-dim:#666C5D;
  --line:#DAD5C4;--line-soft:#E6E2D3;--pine:#2F4B3C;--pine-deep:#213629;--moss:#5F8F6B;
  --moss-deep:#3E6B4A;--amber:#C1893A;--amber-deep:#96692A;--rust:#B0472F;--rust-deep:#833423;
  --verde-tint:rgba(95,143,107,0.16);--verde-tint-strong:rgba(95,143,107,0.18);--verde-tint-soft:rgba(95,143,107,0.10);
  --verde-light:#8FCF9E;--verde-toast-bg:#E4EFE5;
  --giallo-tint:rgba(193,137,58,0.16);--giallo-tint-strong:rgba(193,137,58,0.18);--giallo-tint-soft:rgba(193,137,58,0.08);
  --rosso-tint:rgba(176,71,47,0.16);--rosso-tint-strong:rgba(176,71,47,0.18);--rosso-tint-deep:rgba(176,71,47,0.28);
  --rosso-toast-bg:#F5E4E0;
  --hero-sub:#CFE0D2;--backdrop:rgba(35,42,34,0.45);
  --radius:12px;--radius-sm:8px;--shadow:0 1px 2px rgba(35,42,34,0.06),0 4px 14px rgba(35,42,34,0.06);
}
:root.dark{
  --stone:#14161C;--panel:#1B1E26;--panel-alt:#20242D;--ink:#EDEEF2;--ink-dim:#8B90A3;
  --line:#2E323F;--line-soft:#242833;--pine:#4C4FE0;--pine-deep:#2E2F86;--moss:#4FD1AE;
  --moss-deep:#8EE9CE;--amber:#F0B429;--amber-deep:#F7CE6E;--rust:#F0645A;--rust-deep:#F5978E;
  --verde-tint:rgba(79,209,174,0.16);--verde-tint-strong:rgba(79,209,174,0.2);--verde-tint-soft:rgba(79,209,174,0.12);
  --verde-light:#8EE9CE;--verde-toast-bg:#17281F;
  --giallo-tint:rgba(240,180,41,0.18);--giallo-tint-strong:rgba(240,180,41,0.22);--giallo-tint-soft:rgba(240,180,41,0.12);
  --rosso-tint:rgba(240,100,90,0.18);--rosso-tint-strong:rgba(240,100,90,0.22);--rosso-tint-deep:rgba(240,100,90,0.32);
  --rosso-toast-bg:#2E1A18;
  --hero-sub:#D2D3F5;--backdrop:rgba(0,0,0,0.6);
  --shadow:0 1px 2px rgba(0,0,0,0.3),0 4px 14px rgba(0,0,0,0.25);
}
body{background:var(--stone);color:var(--ink);font-family:'Work Sans',sans-serif;font-size:14px;line-height:1.45;-webkit-font-smoothing:antialiased;}
h1,h2,h3,h4{font-family:'Bitter',serif;margin:0;letter-spacing:-0.01em;}
.mono{font-family:'JetBrains Mono',monospace;}
.dim{color:var(--ink-dim);}
button{font-family:inherit;}
:focus-visible{outline:2px solid var(--pine);outline-offset:2px;}
#app{max-width:1180px;margin:0 auto;padding:0 20px 60px;}
.app-loading{display:flex;align-items:center;justify-content:center;height:100vh;background:var(--stone);}
.spin{width:26px;height:26px;border-radius:50%;border:3px solid var(--line);border-top-color:var(--pine);animation:spin 0.8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

.hero{background:linear-gradient(160deg,var(--pine) 0%,var(--pine-deep) 100%);color:#F3F0E4;margin:0 -20px 0;padding:34px 20px 26px;border-radius:0 0 22px 22px;position:relative;overflow:hidden;}
.hero-top{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;position:relative;z-index:1;}
.hero-brand{display:flex;align-items:center;gap:12px;}
.hero-mark{width:42px;height:42px;border-radius:10px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.18);flex-shrink:0;overflow:hidden;}
.hero-mark-img{width:100%;height:100%;object-fit:cover;}
.hero-brand h1{font-size:21px;font-weight:800;color:#fff;}
.hero-brand .sub{font-size:11.5px;color:var(--hero-sub);text-transform:uppercase;letter-spacing:0.09em;margin-top:1px;}
.hero-actions{display:flex;gap:8px;}
.icon-btn-hero{width:34px;height:34px;border-radius:9px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.16);color:#F3F0E4;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.icon-btn-hero:hover{background:rgba(255,255,255,0.16);}
.hero-progress{margin-top:22px;position:relative;z-index:1;}
.hero-progress-row{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px;flex-wrap:wrap;gap:6px;}
.hero-progress-label{font-size:12px;color:var(--hero-sub);text-transform:uppercase;letter-spacing:0.07em;font-weight:600;}
.hero-progress-value{font-size:15px;font-weight:700;color:#fff;}
.hero-track{height:9px;border-radius:6px;background:rgba(255,255,255,0.14);overflow:hidden;}
.hero-fill{height:100%;background:linear-gradient(90deg,var(--moss),var(--verde-light));border-radius:6px;transition:width .35s ease;}
.hero-stats{display:flex;gap:22px;margin-top:16px;flex-wrap:wrap;position:relative;z-index:1;}
.hero-stat .n{font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:700;color:#fff;}
.hero-stat .l{font-size:10.5px;color:#CFE0D2;text-transform:uppercase;letter-spacing:0.06em;}

.tabs{display:flex;gap:10px;margin:22px 0 22px;}
.tab-btn{flex:1;display:flex;align-items:center;gap:10px;justify-content:center;background:var(--panel);border:1px solid var(--line);color:var(--ink-dim);padding:13px 16px;border-radius:var(--radius);cursor:pointer;font-weight:600;font-size:13.5px;box-shadow:var(--shadow);}
.tab-btn .tab-num{font-family:'JetBrains Mono',monospace;font-size:11px;width:20px;height:20px;border-radius:50%;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.tab-btn.active{background:var(--pine);border-color:var(--pine);color:#fff;}
.tab-btn.active .tab-num{border-color:rgba(255,255,255,0.4);color:#fff;}

.stat-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:18px;}
.stat-card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius-sm);padding:12px 14px;}
.stat-card .l{font-size:10.5px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-dim);margin-bottom:5px;font-weight:600;}
.stat-card .v{font-family:'JetBrains Mono',monospace;font-size:19px;font-weight:700;}
.stat-card .v.verde{color:var(--moss-deep);}
.stat-card .v.giallo{color:var(--amber-deep);}
.stat-card .v.rosso{color:var(--rust-deep);}

.section{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:18px 20px;margin-bottom:18px;box-shadow:var(--shadow);}
.section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;}
.section-head h3{font-size:15.5px;font-weight:700;}
.section-head .eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:0.09em;color:var(--moss-deep);font-weight:700;display:block;margin-bottom:2px;}

.ridge-wrap{overflow-x:auto;padding-bottom:6px;}
.ridge-empty{padding:30px 10px;text-align:center;color:var(--ink-dim);font-size:12.5px;}
.ridge-legend{display:flex;gap:16px;margin-top:10px;flex-wrap:wrap;}
.ridge-legend span{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--ink-dim);}
.ridge-legend i{width:9px;height:9px;border-radius:50%;display:inline-block;}

.cal-nav{display:flex;align-items:center;gap:12px;margin-bottom:12px;}
.cal-title{font-family:'Bitter',serif;font-weight:700;font-size:14.5px;min-width:130px;text-align:center;}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;}
.cal-dow{text-align:center;font-size:10px;font-weight:700;color:var(--ink-dim);text-transform:uppercase;letter-spacing:0.05em;padding-bottom:4px;}
.cal-cell{aspect-ratio:1/0.82;border-radius:7px;border:1px solid var(--line-soft);background:var(--panel-alt);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;position:relative;font-size:10.5px;color:var(--ink-dim);}
.cal-cell .d{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:11.5px;}
.cal-cell.outside{opacity:0.32;}
.cal-cell.pending{border:1.5px dashed var(--amber);color:var(--amber-deep);}
.cal-cell.skipped{background:repeating-linear-gradient(135deg, var(--rosso-tint) 0 6px, var(--rosso-tint-deep) 6px 12px);border-color:var(--rust);color:var(--rust-deep);}
.cal-cell.verde{background:var(--verde-tint-strong);border-color:var(--moss);color:var(--moss-deep);}
.cal-cell.giallo{background:var(--giallo-tint-strong);border-color:var(--amber);color:var(--amber-deep);}
.cal-cell.rosso{background:var(--rosso-tint-strong);border-color:var(--rust);color:var(--rust-deep);}
.cal-cell .tag{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;}
.cal-cell.today{box-shadow:0 0 0 2px var(--pine) inset;}

.form-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;}
.field{display:flex;flex-direction:column;gap:5px;}
.field span{font-size:10.5px;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-dim);font-weight:600;}
input,select{background:var(--stone);border:1px solid var(--line);color:var(--ink);border-radius:7px;padding:9px 10px;font-size:13px;font-family:'JetBrains Mono',monospace;width:100%;outline:none;}
input:focus,select:focus{border-color:var(--pine);}
.form-preview{display:flex;align-items:center;gap:14px;margin-top:14px;padding:12px 14px;background:var(--stone);border-radius:9px;border:1px solid var(--line-soft);flex-wrap:wrap;}
.form-preview .pv-item{display:flex;flex-direction:column;gap:2px;}
.form-preview .pv-item .n{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:15px;}
.form-actions{display:flex;gap:10px;margin-top:16px;}

.btn{display:inline-flex;align-items:center;gap:7px;background:var(--panel-alt);border:1px solid var(--line);color:var(--ink);padding:9px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;}
.btn:hover{border-color:var(--pine);}
.btn.primary{background:var(--pine);border-color:var(--pine);color:#fff;}
.btn.primary:hover{background:var(--pine-deep);}
.btn.danger{background:var(--rust);border-color:var(--rust);color:#fff;}
.btn.ghost{background:transparent;}
.btn:disabled{opacity:0.5;cursor:not-allowed;}

.chip-toggle{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--stone);border:1px solid var(--line);border-radius:9px;padding:10px 12px;cursor:pointer;font-size:12.5px;font-weight:600;}
.chip-toggle .mark{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;border:1.5px solid var(--line);color:var(--ink-dim);flex-shrink:0;}
.chip-toggle.on{border-color:var(--moss);background:var(--verde-tint-soft);}
.chip-toggle.on .mark{background:var(--moss);border-color:var(--moss);color:#fff;}
.chip-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:9px;}

.table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:9px;}
table{width:100%;border-collapse:collapse;font-size:12.5px;}
thead th{background:var(--panel-alt);color:var(--ink-dim);text-align:left;padding:9px 10px;font-size:10px;text-transform:uppercase;letter-spacing:0.04em;font-weight:700;border-bottom:1px solid var(--line);white-space:nowrap;}
tbody td{padding:8px 10px;border-bottom:1px solid var(--line-soft);white-space:nowrap;}
tbody tr:hover td{background:var(--panel-alt);}
.empty-row{text-align:center;color:var(--ink-dim);padding:26px !important;}
.badge{padding:3px 9px;border-radius:5px;font-size:10.5px;font-weight:700;letter-spacing:0.02em;}
.badge.verde{background:var(--verde-tint);color:var(--moss-deep);}
.badge.giallo{background:var(--giallo-tint);color:var(--amber-deep);}
.badge.rosso{background:var(--rosso-tint);color:var(--rust-deep);}
.mini-check{font-weight:700;}
.mini-check.on{color:var(--moss-deep);}
.mini-check.off{color:var(--rust-deep);}
.row-actions{display:flex;gap:5px;}
.icon-btn{background:transparent;border:1px solid var(--line);color:var(--ink-dim);border-radius:6px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;}
.icon-btn:hover{color:var(--ink);border-color:var(--pine);}
.icon-btn.danger:hover{color:var(--rust);border-color:var(--rust);}

.backdrop{position:fixed;inset:0;background:var(--backdrop);z-index:60;display:flex;justify-content:flex-end;}
.backdrop.center{align-items:center;justify-content:center;padding:20px;}
.drawer{width:360px;max-width:92vw;background:var(--panel);height:100%;overflow-y:auto;padding:20px;border-left:1px solid var(--line);}
.drawer h3{margin-bottom:16px;}
.drawer-close{float:right;}
.drawer-section{margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid var(--line-soft);}
.drawer-section h4{font-size:11.5px;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-dim);margin-bottom:10px;}
.habit-edit-row{display:flex;gap:6px;align-items:center;margin-bottom:7px;}
.habit-edit-row input{flex:1;}
.confirm-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:22px;max-width:320px;text-align:center;}
.confirm-card h4{margin-bottom:8px;font-size:15px;}
.confirm-card p{font-size:12.5px;color:var(--ink-dim);margin-bottom:16px;line-height:1.5;}
.confirm-actions{display:flex;gap:8px;}
.confirm-actions .btn{flex:1;justify-content:center;}

.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:11px 18px;border-radius:9px;font-size:12.5px;font-weight:600;z-index:100;box-shadow:0 8px 24px rgba(0,0,0,0.18);}
.toast.success{background:var(--verde-toast-bg);border:1px solid var(--moss);color:var(--moss-deep);}
.toast.error{background:var(--rosso-toast-bg);border:1px solid var(--rust);color:var(--rust-deep);}

.login-screen{min-height:100vh;display:flex;background:var(--stone);color:var(--ink);}
.login-left{flex:1.3;display:flex;flex-direction:column;justify-content:center;padding:60px 70px;position:relative;overflow:hidden;min-width:0;}
.login-left::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 20% 20%, var(--verde-tint-soft), transparent 45%),radial-gradient(circle at 80% 80%, var(--giallo-tint-soft), transparent 45%);}
.login-brand-row{display:flex;align-items:center;gap:10px;z-index:1;margin-bottom:40px;position:relative;}
.login-mark{width:38px;height:38px;border-radius:9px;background:var(--pine);color:#F3F0E4;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.login-mark-img{width:100%;height:100%;object-fit:cover;}
.login-brand-row .brand-wordmark{font-family:'Bitter',serif;font-weight:700;font-size:16px;}
.login-brand-row .brand-wordmark .b2{color:var(--moss-deep);}
.login-hero{z-index:1;max-width:480px;position:relative;}
.login-hero h1{font-family:'Bitter',serif;font-size:38px;line-height:1.12;margin:0 0 16px;font-weight:700;}
.login-hero h1 span{color:var(--moss-deep);}
.login-hero p{color:var(--ink-dim);font-size:14px;line-height:1.6;margin:0;}
.login-right{width:420px;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:40px;border-left:1px solid var(--line);background:var(--panel);}
.login-card{width:100%;max-width:320px;text-align:left;}
.login-card-eyebrow{color:var(--moss-deep);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;}
.login-card h1{font-family:'Bitter',serif;font-size:22px;margin:0 0 6px;font-weight:700;}
.login-card p{margin:0 0 20px;font-size:12.5px;color:var(--ink-dim);}
.login-form{display:flex;flex-direction:column;gap:12px;margin-top:16px;}
.link-btn{background:none;border:none;color:var(--moss-deep);font-size:12px;cursor:pointer;padding:0;text-align:left;}
.link-btn:hover{text-decoration:underline;}
.form-error{color:var(--rust-deep);font-size:12px;}
.form-info{color:var(--moss-deep);font-size:12px;line-height:1.5;}
@media (max-width:860px){.login-left{display:none;}.login-right{width:100%;border-left:none;}}

@media (max-width:640px){
  #app{padding:0 12px 40px;}
  .hero{margin:0 -12px 0;padding:24px 14px 20px;}
  .tabs{flex-direction:column;}
  .cal-cell .d{font-size:10px;}
  .cal-cell .tag{display:none;}
}
`;
