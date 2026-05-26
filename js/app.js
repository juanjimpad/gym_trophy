import { FIREBASE_CONFIG }            from "./firebase.js";
import { state }                      from "./state.js";
import { initTheme, setTheme }        from "./theme.js";
import { mergeClient, isEditing }     from "./utils.js";
import { setDb, adj, setField, setBand, saveSession,
         addClient, updateClientProfile, deleteClient, deleteSession,
         addCustomExercise, addChallenge, finishChallenge, deleteChallenge,
         saveChallengeResult, migrateIfNeeded } from "./db.js";
import { render, showToast, showSaving, showSaveError } from "./render.js";
import { t } from "./i18n.js";
import { IS_DEV, APP_VERSION } from "./config.js";

// ── Connectivity ──────────────────────────────────────────────────────────────

function checkOnline() {
  const online = navigator.onLine;
  if (state.isOnline !== online) {
    state.isOnline = online;
    render();
  }
  return online;
}

// ── Theme ─────────────────────────────────────────────────────────────────────

initTheme();

// ── Dev banner ────────────────────────────────────────────────────────────────

(function () {
  const host     = location.hostname;
  const PROD     = ['gym-trophy.com', 'gym-trophy.workers.dev'];
  const isLocal  = host === 'localhost' || host === '127.0.0.1' || host === '';
  const isDev    = !PROD.includes(host) && (isLocal || host.includes('.pages.dev') || host.includes('.workers.dev'));
  if (!isDev) return;

  const sub   = host.split('.')[0];
  const label = isLocal             ? 'local'
    : (sub && sub !== 'gym-trophy') ? `rama: ${sub}`
    :                                 'preview';

  const banner = document.getElementById('dev-banner');
  if (!banner) return;
  const ver = APP_VERSION.includes('BUILD_') ? '' : ` · ${APP_VERSION}`;
  banner.textContent = `⚠️ Entorno de desarrollo · ${label}${ver}`;
  banner.classList.remove('hidden');
})();

// ── Firebase init ─────────────────────────────────────────────────────────────

firebase.initializeApp(FIREBASE_CONFIG);
const db   = firebase.database();
const auth = firebase.auth();
setDb(db);

// ── Auth ──────────────────────────────────────────────────────────────────────

auth.onAuthStateChanged(async user => {
  const wasLoggedIn = state.currentUser !== null;
  state.currentUser = user ?? null;
  if (user) {
    try { await migrateIfNeeded(); } catch (_) {}
    startDataListeners(user.uid);
  } else {
    stopDataListeners();
    if (wasLoggedIn) showToast(t.sessionExpired);
  }
  render();
});

let listenerRefs = [];

function stopDataListeners() {
  listenerRefs.forEach(r => r.off());
  listenerRefs = [];
  state.clients         = {};
  state.customExercises = {};
  state.challenges      = {};
}

function startDataListeners(uid) {
  stopDataListeners();

  const exRef = db.ref(`users/${uid}/customExercises`);
  exRef.on("value", snap => {
    state.customExercises = snap.val() ?? {};
    Object.values(state.clients).forEach(mergeClient);
    if (!isEditing()) render();
  });
  listenerRefs.push(exRef);

  const clientsRef = db.ref(`users/${uid}/clients`);
  clientsRef.on("value", snap => {
    state.clients = snap.val() ?? {};
    Object.values(state.clients).forEach(mergeClient);
    if (!isEditing()) render();
  });
  listenerRefs.push(clientsRef);

  const challengesRef = db.ref(`users/${uid}/challenges`);
  challengesRef.on("value", snap => {
    state.challenges = snap.val() ?? {};
    if (!isEditing()) render();
  });
  listenerRefs.push(challengesRef);
}

function nav(view) {
  if (state.chartTimer) { clearTimeout(state.chartTimer); state.chartTimer = null; }
  if (state.chartInstance) { state.chartInstance.destroy(); state.chartInstance = null; }
  state.view = view;
  window.scrollTo(0, 0);
  render();
}

// ── Event delegation ──────────────────────────────────────────────────────────

document.getElementById("app").addEventListener("click", handleClick);
document.getElementById("app").addEventListener("change", handleChange);
document.getElementById("app").addEventListener("input", handleInput);

function handleClick(e) {
  // Walk up to find nearest element with data-action
  const el = e.target.closest("[data-action]");
  if (!el) return;

  const action = el.dataset.action;

  // Close modal only when clicking directly on the background overlay
  if (action.startsWith("close-") || action === "panel-bg") {
    if (e.target === el) {
      handleModalClose(action);
    }
    if (e.target !== el) return;
    return;
  }

  switch (action) {
    // ── Auth ─────────────────────────────────────────────────────────────────
    case "login": {
      const email    = document.getElementById("loginEmail")?.value?.trim();
      const password = document.getElementById("loginPassword")?.value;
      if (!email || !password) { state.loginError = t.loginRequired; render(); break; }
      if (!checkOnline()) break;
      document.getElementById("loginBtn").textContent = t.loginSigningIn;
      auth.signInWithEmailAndPassword(email, password)
        .then(() => { state.loginError = null; state.isOnline = true; })
        .catch(err => {
          checkOnline();
          state.loginError = err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found"
            ? t.loginBadCredentials
            : err.code === "auth/network-request-failed"
            ? t.offline
            : t.loginFailed;
          render();
        });
      break;
    }

    case "login-google": {
      if (!checkOnline()) break;
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider)
        .then(() => { state.loginError = null; })
        .catch(err => {
          if (err.code === "auth/popup-closed-by-user") return;
          state.loginError = t.loginGoogleFailed;
          render();
        });
      break;
    }

    case "set-theme":
      setTheme(el.dataset.theme);
      render();
      break;

    case "logout":
      if (!confirm(t.logoutConfirm)) break;
      auth.signOut();
      state.view = "home";
      break;

    case "open-access-panel":
      state.showAccessPanel = true;
      render();
      break;

    // ── Navigation ──────────────────────────────────────────────────────────
    case "go-home":
      closeAllModals();
      nav("home");
      break;

    case "go-weights":
    case "go-weights-list":
      nav("weights-list");
      break;

    case "go-clients":
      state.clientsSearch = "";
      nav("clients-list");
      break;

    case "go-challenges":
    case "go-challenges-list":
      nav("challenges-list");
      break;

    case "go-leaderboard":
      if (el.dataset.exk) { state.selectedExKey = el.dataset.exk; state.leaderboardSearch = ""; }
      nav("weights-leaderboard");
      break;

    case "go-session": {
      const clientKey = el.dataset.client;
      state.selectedClientKey = clientKey;
      state.sessionOrigin     = state.view === "weights-leaderboard" ? "leaderboard"
                              : state.view === "clients-list"         ? "clients-list"
                              : "home";
      nav("session");
      break;
    }

    case "go-exercise-history":
      state.selectedExKey = el.dataset.exk;
      nav("exercise-history");
      break;

    case "go-back-session":
      nav("session");
      break;

    case "go-challenge":
      state.selectedChallengeKey = el.dataset.key;
      state.challengeSearch      = "";
      nav("challenge-detail");
      break;

    // ── Clients panel ────────────────────────────────────────────────────────
    case "open-add-client":
      state.showAddClientModal = true;
      render();
      break;

    case "confirm-add-client": {
      const val       = document.getElementById("newClientInput")?.value;
      const sex       = document.querySelector("input[name='newClientSex']:checked")?.value || null;
      const birthDate = document.getElementById("newClientBirthDate")?.value || null;
      if (val?.trim()) {
        addClient(val, sex, birthDate)
          .then(() => showToast(t.clientAdded))
          .catch(() => showSaveError(t.clientAddError));
      }
      state.showAddClientModal = false;
      render();
      break;
    }

    case "close-add-client":
      state.showAddClientModal = false;
      render();
      break;

    case "edit-client":
      state.selectedClientKey  = el.dataset.key;
      state.showEditClientModal = true;
      render();
      break;

    case "confirm-edit-client": {
      const val       = document.getElementById("editClientInput")?.value;
      const sex       = document.querySelector("input[name='editClientSex']:checked")?.value || null;
      const birthDate = document.getElementById("editClientBirthDate")?.value || null;
      if (val?.trim()) {
        updateClientProfile(state.selectedClientKey, val, sex, birthDate)
          .then(() => showSaving())
          .catch(() => showSaveError());
      }
      state.showEditClientModal = false;
      render();
      break;
    }

    case "close-edit-client":
      state.showEditClientModal = false;
      render();
      break;

    case "delete-client": {
      const key  = el.dataset.key;
      const name = state.clients[key]?.name ?? key;
      if (!confirm(t.clientDeleteConfirm(name))) break;
      deleteClient(key)
        .then(() => showToast(t.clientDeleted))
        .catch(() => showSaveError(t.clientDeleteError));
      break;
    }

    case "delete-session": {
      const { client: ck, exk, datekey } = el.dataset;
      if (!confirm(t.deleteSessionConfirm)) break;
      deleteSession(ck, exk, datekey)
        .then(() => showToast(t.sessionDeleted))
        .catch(() => showSaveError());
      break;
    }

    // ── Custom exercise ──────────────────────────────────────────────────────
    case "open-add-ex":
      state.showAddExModal = true;
      render();
      break;

    case "confirm-add-ex": {
      const val = document.getElementById("newExInput")?.value;
      if (val?.trim()) {
        addCustomExercise(val)
          .then(() => showToast(t.exAdded(val.trim())))
          .catch(() => showSaveError());
      }
      state.showAddExModal = false;
      render();
      break;
    }

    case "close-add-ex":
      state.showAddExModal = false;
      render();
      break;

    // ── Session ──────────────────────────────────────────────────────────────
    case "save-session": {
      const clientKey = el.dataset.client ?? state.selectedClientKey;
      flushFocusedInput();
      const onlyEx = state.sessionOrigin === "leaderboard" ? state.selectedExKey : null;
      saveSession(clientKey, onlyEx)
        .then(() => showToast(t.sessionSaved))
        .catch(err => { if (IS_DEV) console.error("[saveSession] save failed:", err); checkOnline(); showSaveError(t.sessionSaveError); });
      nav(state.sessionOrigin === "leaderboard" ? "weights-leaderboard"
        : state.sessionOrigin === "clients-list" ? "clients-list"
        : "home");
      break;
    }

    case "adj": {
      flushFocusedInput();
      adj(state.selectedClientKey, el.dataset.exk, el.dataset.field, parseInt(el.dataset.delta))
        .then(() => showSaving())
        .catch(err => { if (IS_DEV) console.error("[adj] save failed:", err); checkOnline(); showSaveError(); });
      render();
      break;
    }

    case "set-band":
      setBand(state.selectedClientKey, el.dataset.exk, el.dataset.band)
        .then(() => showSaving())
        .catch(err => { if (IS_DEV) console.error("[setBand] save failed:", err); checkOnline(); showSaveError(); });
      render();
      break;

    // ── Challenges ───────────────────────────────────────────────────────────
    case "open-add-challenge":
      state.showAddChallengeModal = true;
      render();
      break;

    case "confirm-add-challenge": {
      const name      = document.getElementById("challengeNameInput")?.value;
      const exName    = document.getElementById("challengeExInput")?.value || null;
      const durVal    = document.getElementById("challengeDurationInput")?.value;
      const duration  = durVal ? parseInt(durVal) : null;
      const metric    = document.querySelector("input[name='challengeMetric']:checked")?.value ?? "reps";
      const startDate = document.getElementById("challengeStartDate")?.value || null;
      const endDate   = document.getElementById("challengeEndDate")?.value   || null;
      if (name?.trim()) {
        addChallenge({ name, exerciseName: exName, duration, metric, startDate, endDate })
          .then(() => showToast(t.challengeCreated))
          .catch(() => showSaveError(t.challengeCreateError));
      }
      state.showAddChallengeModal = false;
      render();
      break;
    }

    case "close-add-challenge":
      state.showAddChallengeModal = false;
      render();
      break;

    case "finish-challenge": {
      const key = el.dataset.key ?? state.selectedChallengeKey;
      if (!confirm(t.finishChallengeConfirm)) break;
      finishChallenge(key)
        .then(() => showToast(t.finishChallengeDone))
        .catch(() => showSaveError());
      nav("challenges-list");
      break;
    }

    case "delete-challenge": {
      const key  = el.dataset.key ?? state.selectedChallengeKey;
      const name = state.challenges[key]?.name ?? key;
      if (!confirm(t.challengeDeleteConfirm(name))) break;
      deleteChallenge(key)
        .then(() => showToast(t.challengeDeleted))
        .catch(() => showSaveError(t.challengeDeleteError));
      nav("challenges-list");
      break;
    }

    case "open-challenge-result":
      state.showChallengeResult = el.dataset.client;
      render();
      break;

    case "confirm-challenge-result": {
      const val = document.getElementById("challengeResultInput")?.value;
      saveChallengeResult(el.dataset.challenge, el.dataset.client, val)
        .then(() => showSaving())
        .catch(() => showSaveError());
      state.showChallengeResult = null;
      render();
      break;
    }

    case "close-challenge-result":
      state.showChallengeResult = null;
      render();
      break;
  }
}

let searchTimer = null;
function handleInput(e) {
  const searchMap = {
    clientsSearch:   "clientsSearch",
    lbSearch:        "leaderboardSearch",
    challengeSearch: "challengeSearch",
  };
  const stateKey = searchMap[e.target.id];
  if (!stateKey) return;
  const id  = e.target.id;
  const pos = e.target.selectionStart;
  state[stateKey] = e.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    render();
    const el = document.getElementById(id);
    if (el) { el.focus(); el.setSelectionRange(pos, pos); }
  }, 150);
}

function handleChange(e) {
  // num-input blur → save field
  if (e.target.classList.contains("num-input")) {
    const { exk, field } = e.target.dataset;
    if (exk && field && state.selectedClientKey) {
      setField(state.selectedClientKey, exk, field, e.target.value)
        ?.then(() => showSaving())
        ?.catch(err => { if (IS_DEV) console.error("[setField] save failed:", err); showSaveError(); });
    }
  }
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (state.showChallengeResult)    { state.showChallengeResult    = null;  render(); return; }
    if (state.showAddChallengeModal)  { state.showAddChallengeModal  = false; render(); return; }
    if (state.showAddExModal)         { state.showAddExModal         = false; render(); return; }
    if (state.showEditClientModal)    { state.showEditClientModal    = false; render(); return; }
    if (state.showAddClientModal)     { state.showAddClientModal     = false; render(); return; }
    if (state.showAccessPanel)        { state.showAccessPanel        = false; render(); return; }
    if (state.view === "clients-list") { nav("home"); return; }
  }
  if (e.key === "Enter") {
    const focused = document.activeElement;
    if (focused?.id === "loginEmail")           { document.getElementById("loginPassword")?.focus();                        return; }
    if (focused?.id === "loginPassword")        { document.querySelector("[data-action='login']")?.click();                 return; }
    if (focused?.id === "newClientInput")       { document.querySelector("[data-action='confirm-add-client']")?.click();    return; }
    if (focused?.id === "editClientInput")      { document.querySelector("[data-action='confirm-edit-client']")?.click();   return; }
    if (focused?.id === "newExInput")           { document.querySelector("[data-action='confirm-add-ex']")?.click();        return; }
    if (focused?.id === "challengeNameInput")   { document.getElementById("challengeExInput")?.focus();                    return; }
    if (focused?.id === "challengeResultInput") { document.querySelector("[data-action='confirm-challenge-result']")?.click(); return; }
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function flushFocusedInput() {
  const focused = document.querySelector(".num-input:focus");
  if (focused) {
    const { exk, field } = focused.dataset;
    if (exk && field && state.selectedClientKey) {
      setField(state.selectedClientKey, exk, field, focused.value);
    }
    focused.blur();
  }
}

function closeAllModals() {
  state.clientsSearch         = "";
  state.showAddClientModal    = false;
  state.showEditClientModal   = false;
  state.showAddExModal        = false;
  state.showAddChallengeModal = false;
  state.showChallengeResult   = null;
}

function handleModalClose(action) {
  switch (action) {
    case "close-access-panel":    state.showAccessPanel       = false; break;
    case "close-add-client":      state.showAddClientModal    = false; break;
    case "close-edit-client":     state.showEditClientModal   = false; break;
    case "close-add-ex":          state.showAddExModal        = false; break;
    case "close-add-challenge":   state.showAddChallengeModal = false; break;
    case "close-challenge-result": state.showChallengeResult  = null;  break;
  }
  render();
}

// ── Service Worker ────────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
