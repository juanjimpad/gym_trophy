import { state }                     from "./state.js";
import { BASE_EXERCISES, BANDS, safeKey, CHIN_KEY } from "./config.js";
import { t } from "./i18n.js";

export function getInitials(n) {
  return n.trim().split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export function formatDate(ts) {
  return new Date(ts).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDateStr(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export function formatDuration(seconds) {
  return seconds < 60 ? `${seconds}s` : `${seconds / 60}min`;
}

export function formatMetricValue(value, metric) {
  if (metric === "time") {
    const m = Math.floor(value / 60);
    const s = value % 60;
    return m > 0 ? `${m}m ${s > 0 ? s + "s" : ""}`.trim() : `${s}s`;
  }
  if (metric === "cal") return `${value} kcal`;
  return `${value} reps`;
}

export function metricLabel(metric) {
  if (metric === "cal")  return t.metricCalLabel;
  if (metric === "time") return t.metricTimeLabel;
  return t.metricRepsLabel;
}

export function metricUnit(metric) {
  if (metric === "cal")  return t.metricCalUnit;
  if (metric === "time") return t.metricTimeUnit;
  return t.metricRepsUnit;
}

export function isChallengeActive(ch) {
  if (!ch.endDate) return true;
  return todayStr() <= ch.endDate;
}

export function isChallengeStarted(ch) {
  if (!ch.startDate) return true;
  return todayStr() >= ch.startDate;
}

export function allExNames() {
  return [...BASE_EXERCISES, ...Object.values(state.customExercises).map(e => e.name)];
}

export function defaultEx(name) {
  const obj = { name, weight: 0, reps: 10, sets: 3 };
  if (safeKey(name) === CHIN_KEY) obj.band = null;
  return obj;
}

export function mergeClient(c) {
  if (!c.exercises) c.exercises = {};
  allExNames().forEach(n => {
    const k = safeKey(n);
    if (!c.exercises[k]) {
      c.exercises[k] = defaultEx(n);
    } else {
      if (c.exercises[k].weight === undefined) c.exercises[k].weight = 0;
      if (c.exercises[k].reps   === undefined) c.exercises[k].reps   = 10;
      if (c.exercises[k].sets   === undefined) c.exercises[k].sets   = 3;
      if (!c.exercises[k].name)                c.exercises[k].name   = n;
      if (k === CHIN_KEY && c.exercises[k].band === undefined) c.exercises[k].band = null;
    }
  });
}

// Returns sorted leaderboard for an exercise key.
// Each entry: { clientKey, name, value, ts, band? }
// Clients without history come last with value=null.
export function getLeaderboard(exKey) {
  const isChin = exKey === CHIN_KEY;
  const results = [];

  Object.entries(state.clients).forEach(([clientKey, client]) => {
    const sex       = client.sex       ?? null;
    const birthDate = client.birthDate ?? null;
    const hist = client.history?.[exKey];
    if (!hist) {
      results.push({ clientKey, name: client.name, sex, birthDate, value: null, ts: null });
      return;
    }
    const entries = Object.values(hist);
    if (isChin) {
      const validEntries = entries.filter(e => (e.reps || 0) > 0);
      if (!validEntries.length) {
        results.push({ clientKey, name: client.name, sex, birthDate, value: null, ts: null });
        return;
      }
      const best = validEntries.reduce((m, e) => (e.reps || 0) > (m.reps || 0) ? e : m, validEntries[0]);
      results.push({ clientKey, name: client.name, sex, birthDate, value: best.reps, ts: best.ts, band: best.band ?? null, isChin: true });
    } else {
      const validEntries = entries.filter(e => (e.weight || 0) > 0);
      if (!validEntries.length) {
        results.push({ clientKey, name: client.name, sex, birthDate, value: null, ts: null });
        return;
      }
      const best = validEntries.reduce((m, e) => (e.weight || 0) > (m.weight || 0) ? e : m, validEntries[0]);
      results.push({ clientKey, name: client.name, sex, birthDate, value: best.weight, ts: best.ts });
    }
  });

  results.sort((a, b) => {
    if (a.value === null && b.value === null) return a.name.localeCompare(b.name);
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    return b.value - a.value;
  });

  return results;
}

// Returns the top entry (or null) for the exercise list crown badge
export function getTopEntry(exKey) {
  const board = getLeaderboard(exKey).filter(r => r.value !== null);
  return board.length ? board[0] : null;
}

export function calcAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

export function bandLabel(id) { return BANDS.find(b => b.id === id)?.label ?? id; }
export function bandColor(id) { return BANDS.find(b => b.id === id)?.color ?? "#ccc"; }

export function medalEmoji(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}.`;
}

export function isEditing() {
  return !!document.querySelector(".num-input:focus");
}
