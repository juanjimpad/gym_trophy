import { state }            from "./state.js";
import { safeKey, CHIN_KEY } from "./config.js";
import { allExNames, defaultEx, todayKey } from "./utils.js";

let db;
export function setDb(ref) { db = ref; }

const uid  = ()       => state.currentUser.uid;
const uref = (path)   => db.ref(`users/${uid()}/${path}`);

// ── Migration (flat root → users/{uid}/) ──────────────────────────────────────

export async function migrateIfNeeded() {
  try {
    const [clientsSnap, challengesSnap, exSnap] = await Promise.all([
      db.ref("clients").once("value"),
      db.ref("challenges").once("value"),
      db.ref("customExercises").once("value"),
    ]);

    const oldClients    = clientsSnap.val();
    const oldChallenges = challengesSnap.val();
    const oldEx         = exSnap.val();

    if (!oldClients && !oldChallenges && !oldEx) return;

    const u   = uid();
    const upd = {};
    if (oldClients)    upd[`users/${u}/clients`]        = oldClients;
    if (oldChallenges) upd[`users/${u}/challenges`]      = oldChallenges;
    if (oldEx)         upd[`users/${u}/customExercises`] = oldEx;
    upd["clients"]         = null;
    upd["challenges"]      = null;
    upd["customExercises"] = null;

    await db.ref().update(upd);
  } catch (_) {
    // Rutas antiguas no accesibles: migración ya realizada o no necesaria
  }
}

// ── Exercise adjustments ──────────────────────────────────────────────────────

export function adj(clientKey, exKey, field, delta) {
  const ex   = state.clients[clientKey].exercises[exKey];
  const step = field === "weight" ? 2.5 : 1;
  ex[field]  = Math.max(0, parseFloat(((ex[field] || 0) + delta * step).toFixed(1)));
  return uref(`clients/${clientKey}/exercises/${exKey}`).set(ex);
}

export function setField(clientKey, exKey, field, rawVal) {
  const val = parseFloat(rawVal);
  if (isNaN(val) || val < 0) return Promise.resolve();
  const ex = state.clients[clientKey].exercises[exKey];
  ex[field] = val;
  return uref(`clients/${clientKey}/exercises/${exKey}`).set(ex);
}

export function setBand(clientKey, exKey, bandId) {
  state.clients[clientKey].exercises[exKey].band = bandId || null;
  return uref(`clients/${clientKey}/exercises/${exKey}/band`).set(bandId || null);
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
        : (ex.weight > 0 || ex.reps !== 10 || ex.sets !== 3);
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
  const key       = "c_" + Date.now();
  const exercises = {};
  allExNames().forEach(n => { exercises[safeKey(n)] = defaultEx(n); });
  state.clients[key] = { name: name.trim(), sex: sex || null, birthDate: birthDate || null, exercises };
  return uref("clients/" + key).set(state.clients[key]);
}

export function updateClientProfile(key, name, sex, birthDate) {
  if (!name.trim()) return Promise.resolve();
  const upd = { name: name.trim(), sex: sex || null, birthDate: birthDate || null };
  Object.assign(state.clients[key], upd);
  return uref(`clients/${key}`).update(upd);
}

export function deleteClient(key) {
  return uref("clients/" + key).remove();
}

export function deleteSession(clientKey, exKey, dateKey) {
  delete state.clients[clientKey]?.history?.[exKey]?.[dateKey];
  return uref(`clients/${clientKey}/history/${exKey}/${dateKey}`).remove();
}

// ── Custom exercises ──────────────────────────────────────────────────────────

export function addCustomExercise(name) {
  if (!name.trim()) return Promise.resolve();
  const key = "custom_" + Date.now();
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
  const key = "ch_" + Date.now();
  return uref("challenges/" + key).set({
    name: name.trim(), exerciseName, duration, metric,
    startDate: startDate || null,
    endDate:   endDate   || null,
    createdAt: Date.now(),
  });
}

export function finishChallenge(key) {
  const today = new Date().toISOString().slice(0, 10);
  if (state.challenges[key]) {
    state.challenges[key].endDate  = today;
    state.challenges[key].finished = true;
  }
  return uref(`challenges/${key}`).update({ endDate: today, finished: true });
}

export function deleteChallenge(key) {
  return uref("challenges/" + key).remove();
}

export function saveChallengeResult(challengeKey, clientKey, value) {
  const v = parseFloat(value);
  if (isNaN(v) || v < 0) return Promise.resolve();
  return uref(`challenges/${challengeKey}/results/${clientKey}`).set({ value: v, ts: Date.now() });
}
