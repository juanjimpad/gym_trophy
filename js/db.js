import { state }                   from "./state.js";
import { safeKey, CHIN_KEY, IS_DEV } from "./config.js";
import { allExNames, defaultEx, todayKey } from "./utils.js";

let db;
export function setDb(ref) { db = ref; }

const uid  = ()       => state.currentUser.uid;
const uref = (path)   => db.ref(`users/${uid()}/${path}`);

// Prefix + timestamp + random suffix to avoid millisecond-level collisions
const uniqueKey = (prefix) => `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const MAX_VALUES = { weight: 500, reps: 100, sets: 50 };

// ── Migration (flat root → users/{uid}/) ──────────────────────────────────────

const MIGRATED_KEY = "gym_trophy_migrated";

export async function migrateIfNeeded() {
  if (localStorage.getItem(MIGRATED_KEY)) return;
  try {
    const [clientsSnap, challengesSnap, exSnap] = await Promise.all([
      db.ref("clients").once("value"),
      db.ref("challenges").once("value"),
      db.ref("customExercises").once("value"),
    ]);

    const oldClients    = clientsSnap.val();
    const oldChallenges = challengesSnap.val();
    const oldEx         = exSnap.val();

    if (!oldClients && !oldChallenges && !oldEx) {
      localStorage.setItem(MIGRATED_KEY, "1");
      return;
    }

    const u   = uid();
    const upd = {};
    if (oldClients)    upd[`users/${u}/clients`]        = oldClients;
    if (oldChallenges) upd[`users/${u}/challenges`]      = oldChallenges;
    if (oldEx)         upd[`users/${u}/customExercises`] = oldEx;
    upd["clients"]         = null;
    upd["challenges"]      = null;
    upd["customExercises"] = null;

    await db.ref().update(upd);
    localStorage.setItem(MIGRATED_KEY, "1");
  } catch (_) {
    // Rutas antiguas no accesibles: migración ya realizada o no necesaria
  }
}

// ── Exercise adjustments ──────────────────────────────────────────────────────

export function adj(clientKey, exKey, field, delta) {
  const ex = state.clients[clientKey]?.exercises?.[exKey];
  if (!ex) return Promise.resolve();
  const step   = field === "weight" ? 2.5 : 1;
  const max    = MAX_VALUES[field] ?? 9999;
  const prev   = ex[field];
  const newVal = Math.min(max, Math.max(0, parseFloat(((ex[field] || 0) + delta * step).toFixed(1))));
  if (newVal === prev) return Promise.resolve();
  ex[field]  = newVal;
  return uref(`clients/${clientKey}/exercises/${exKey}`).set(ex)
    .catch(e => {
      ex[field] = prev;
      if (IS_DEV) console.error("[adj] error:", e, { clientKey, exKey, field });
      return Promise.reject(e);
    });
}

export function setField(clientKey, exKey, field, rawVal) {
  const ex  = state.clients[clientKey]?.exercises?.[exKey];
  if (!ex) return Promise.resolve();
  const val = parseFloat(rawVal);
  const max = MAX_VALUES[field] ?? 9999;
  if (isNaN(val) || val < 0 || val > max) return Promise.resolve();
  if (val === ex[field]) return Promise.resolve();
  const prev = ex[field];
  ex[field]  = val;
  return uref(`clients/${clientKey}/exercises/${exKey}`).set(ex)
    .catch(e => {
      ex[field] = prev;
      if (IS_DEV) console.error("[setField] error:", e, { clientKey, exKey, field, rawVal });
      return Promise.reject(e);
    });
}

export function setBand(clientKey, exKey, bandId) {
  const ex = state.clients[clientKey]?.exercises?.[exKey];
  if (!ex) return Promise.resolve();
  const prev    = ex.band;
  const newBand = bandId || null;
  if (newBand === prev) return Promise.resolve();
  ex.band = newBand;
  return uref(`clients/${clientKey}/exercises/${exKey}/band`).set(newBand)
    .catch(e => {
      ex.band = prev;
      if (IS_DEV) console.error("[setBand] error:", e, { clientKey, exKey, bandId });
      return Promise.reject(e);
    });
}

// ── Session save ──────────────────────────────────────────────────────────────

export function saveSession(clientKey, onlyExKey = null) {
  const c   = state.clients[clientKey];
  const dk  = todayKey();
  const ts  = Date.now();
  const u   = uid();
  const upd = {};

  const names = onlyExKey
    ? allExNames().filter(n => safeKey(n) === onlyExKey)
    : allExNames();

  names.forEach(n => {
    const k      = safeKey(n);
    const ex     = c.exercises[k];
    const isChin = k === CHIN_KEY;

    if (!onlyExKey) {
      const hasRealData = isChin
        ? (ex.band !== null || ex.reps !== 10 || ex.sets !== 3)
        : (ex.reps > 0 && ex.sets > 0);
      if (!hasRealData) return;
    }

    const entry = { ts, reps: ex.reps || 10, sets: ex.sets || 3 };
    if (isChin) entry.band   = ex.band   ?? null;
    else        entry.weight = ex.weight  ?? 0;
    upd[`users/${u}/clients/${clientKey}/history/${k}/${dk}`] = entry;
  });

  return Object.keys(upd).length ? db.ref().update(upd) : Promise.resolve();
}

// ── Clients ───────────────────────────────────────────────────────────────────

export function addClient(name, sex = null, birthDate = null) {
  if (!name.trim()) return Promise.resolve();
  const key       = uniqueKey("c_");
  const exercises = {};
  allExNames().forEach(n => { exercises[safeKey(n)] = defaultEx(n); });
  const client = { name: name.trim(), sex: sex || null, birthDate: birthDate || null, exercises };
  state.clients[key] = client;
  return uref("clients/" + key).set(client)
    .catch(e => {
      delete state.clients[key];
      return Promise.reject(e);
    });
}

export function updateClientProfile(key, name, sex, birthDate) {
  if (!name.trim() || !state.clients[key]) return Promise.resolve();
  const upd  = { name: name.trim(), sex: sex || null, birthDate: birthDate || null };
  const prev = { name: state.clients[key].name, sex: state.clients[key].sex, birthDate: state.clients[key].birthDate };
  Object.assign(state.clients[key], upd);
  return uref(`clients/${key}`).update(upd)
    .catch(e => {
      Object.assign(state.clients[key], prev);
      return Promise.reject(e);
    });
}

export function deleteClient(key) {
  return uref("clients/" + key).remove();
}

export function deleteSession(clientKey, exKey, dateKey) {
  const saved = state.clients[clientKey]?.history?.[exKey]?.[dateKey];
  delete state.clients[clientKey]?.history?.[exKey]?.[dateKey];
  return uref(`clients/${clientKey}/history/${exKey}/${dateKey}`).remove()
    .catch(e => {
      if (saved !== undefined && state.clients[clientKey]?.history?.[exKey]) {
        state.clients[clientKey].history[exKey][dateKey] = saved;
      }
      return Promise.reject(e);
    });
}

// ── Custom exercises ──────────────────────────────────────────────────────────

export function addCustomExercise(name) {
  if (!name.trim()) return Promise.resolve();
  const key = uniqueKey("custom_");
  const u   = uid();
  const p1  = uref("customExercises/" + key).set({ name: name.trim(), custom: true });
  const upd = {};
  Object.keys(state.clients).forEach(ck => {
    upd[`users/${u}/clients/${ck}/exercises/${safeKey(name.trim())}`] = defaultEx(name.trim());
  });
  const p2 = Object.keys(upd).length ? db.ref().update(upd) : Promise.resolve();
  return Promise.all([p1, p2]);
}

// ── Challenges ────────────────────────────────────────────────────────────────

export function addChallenge({ name, exerciseName, duration, metric, startDate, endDate }) {
  if (!name.trim()) return Promise.resolve();
  const key = uniqueKey("ch_");
  return uref("challenges/" + key).set({
    name: name.trim(), exerciseName, duration, metric,
    startDate: startDate || null,
    endDate:   endDate   || null,
    createdAt: Date.now(),
  });
}

export function finishChallenge(key) {
  if (!state.challenges[key]) return Promise.resolve();
  const today = new Date().toISOString().slice(0, 10);
  const prev  = { endDate: state.challenges[key].endDate, finished: state.challenges[key].finished };
  state.challenges[key].endDate  = today;
  state.challenges[key].finished = true;
  return uref(`challenges/${key}`).update({ endDate: today, finished: true })
    .catch(e => {
      Object.assign(state.challenges[key], prev);
      return Promise.reject(e);
    });
}

export function deleteChallenge(key) {
  return uref("challenges/" + key).remove();
}

export function saveChallengeResult(challengeKey, clientKey, value) {
  const v = parseFloat(value);
  if (isNaN(v) || v < 0) return Promise.resolve();
  return uref(`challenges/${challengeKey}/results/${clientKey}`).set({ value: v, ts: Date.now() });
}
