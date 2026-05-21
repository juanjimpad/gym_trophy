import { FIREBASE_CONFIG }            from "./firebase.js";
import { state }                      from "./state.js";
import { mergeClient, isEditing }     from "./utils.js";
import { setDb, adj, setField, setBand, saveSession,
         addClient, updateClientProfile, deleteClient, deleteSession,
         addCustomExercise, addChallenge, deleteChallenge,
         saveChallengeResult }         from "./db.js";
import { render, renderLogin, showToast, showSaving, showSaveError } from "./render.js";
import { t } from "./i18n.js";

// ── Firebase init ─────────────────────────────────────────────────────────────

firebase.initializeApp(FIREBASE_CONFIG);
const db   = firebase.database();
const auth = firebase.auth();
setDb(db);

// ── Auth ──────────────────────────────────────────────────────────────────────

auth.onAuthStateChanged(user => {
  state.currentUser = user ?? null;
  if (user) {
    // Start data listeners only after login
    startDataListeners();
  }
  render();
});

let listenersStarted = false;
function startDataListeners() {
  if (listenersStarted) return;
  listenersStarted = true;

  db.ref(".info/connected").on("value", snap => {
    const wasOnline = state.isOnline;
    state.isOnline  = snap.val() === true;
    const dot = document.getElementById("statusDot");
    if (dot) dot.className = "status-dot" + (state.isOnline ? " online" : "");
    if (wasOnline !== state.isOnline) render();
  });

  db.ref("customExercises").on("value", snap => {
    state.customExercises = snap.val() ?? {};
    Object.values(state.clients).forEach(mergeClient);
    if (!isEditing()) render();
  });

  db.ref("clients").on("value", snap => {
    state.clients = snap.val() ?? {};
    Object.values(state.clients).forEach(mergeClient);
    if (!isEditing()) render();
  });

  db.ref("challenges").on("value", snap => {
    state.challenges = snap.val() ?? {};
    if (!isEditing()) render();
  });
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
      document.getElementById("loginBtn").textContent = t.loginSigningIn;
      auth.signInWithEmailAndPassword(email, password)
        .then(() => { state.loginError = null; })
        .catch(err => {
          state.loginError = err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found"
            ? t.loginBadCredentials
            : t.loginFailed;
          render();
        });
      break;
    }

    case "logout":
      if (!confirm(t.logoutConfirm)) break;
      auth.signOut();
      state.view = "home";
      break;

    case "open-access-panel":
      state.showAccessPanel = true;
      render();
      break;

    case "close-access-panel":
      if (e.target === el) { state.showAccessPanel = false; render(); }
      break;

    // ── Navigation ──────────────────────────────────────────────────────────
    case "go-home":
      closeAllModals();
      state.view = "home";
      render();
      break;

    case "go-weights":
      state.view = "weights-list";
      render();
      break;

    case "go-weights-list":
      state.view = "weights-list";
      render();
      break;

    case "go-challenges":
      state.view = "challenges-list";
      render();
      break;

    case "go-challenges-list":
      state.view = "challenges-list";
      render();
      break;

    case "go-leaderboard":
      state.view = "weights-leaderboard";
      // exk may already be set; if coming from ex-list row, update it
      if (el.dataset.exk) state.selectedExKey = el.dataset.exk;
      render();
      break;

    case "go-session": {
      const clientKey = el.dataset.client;
      state.selectedClientKey = clientKey;
      state.sessionOrigin     = state.view === "weights-leaderboard" ? "leaderboard" : "clients-panel";
      state.view              = "session";
      render();
      break;
    }

    case "go-exercise-history":
      state.selectedExKey = el.dataset.exk;
      state.view          = "exercise-history";
      render();
      break;

    case "go-back-session":
      state.view = "session";
      render();
      break;

    case "go-challenge":
      state.selectedChallengeKey = el.dataset.key;
      state.view                 = "challenge-detail";
      render();
      break;

    // ── Clients panel ────────────────────────────────────────────────────────
    case "open-clients-panel":
      state.showClientsPanel = true;
      render();
      break;

    case "close-clients-panel":
      if (e.target === el) { state.showClientsPanel = false; state.clientsSearch = ""; render(); }
      break;

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
      // Flush any focused input first
      flushFocusedInput();
      const onlyEx = state.sessionOrigin === "leaderboard" ? state.selectedExKey : null;
      saveSession(clientKey, onlyEx)
        .then(() => showToast(t.sessionSaved))
        .catch(() => showSaveError(t.sessionSaveError));
      break;
    }

    case "adj": {
      flushFocusedInput();
      adj(state.selectedClientKey, el.dataset.exk, el.dataset.field, parseInt(el.dataset.delta))
        .then(() => showSaving())
        .catch(() => showSaveError());
      render();
      break;
    }

    case "set-band":
      setBand(state.selectedClientKey, el.dataset.exk, el.dataset.band)
        .then(() => showSaving())
        .catch(() => showSaveError());
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

    case "delete-challenge": {
      const key  = el.dataset.key ?? state.selectedChallengeKey;
      const name = state.challenges[key]?.name ?? key;
      if (!confirm(t.challengeDeleteConfirm(name))) break;
      deleteChallenge(key)
        .then(() => showToast(t.challengeDeleted))
        .catch(() => showSaveError(t.challengeDeleteError));
      state.view = "challenges-list";
      render();
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

function handleInput(e) {
  if (e.target.id === "clientsSearch") {
    const pos = e.target.selectionStart;
    state.clientsSearch = e.target.value;
    render();
    const el = document.getElementById("clientsSearch");
    if (el) { el.focus(); el.setSelectionRange(pos, pos); }
  }
}

function handleChange(e) {
  // num-input blur → save field
  if (e.target.classList.contains("num-input")) {
    const { exk, field } = e.target.dataset;
    if (exk && field && state.selectedClientKey) {
      setField(state.selectedClientKey, exk, field, e.target.value)
        ?.then(() => showSaving())
        ?.catch(() => showSaveError());
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
    if (state.showClientsPanel)       { state.showClientsPanel = false; state.clientsSearch = ""; render(); return; }
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
  state.showClientsPanel      = false;
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
    case "close-clients-panel":   state.showClientsPanel = false; state.clientsSearch = ""; break;
    case "close-add-client":      state.showAddClientModal    = false; break;
    case "close-edit-client":     state.showEditClientModal   = false; break;
    case "close-add-ex":          state.showAddExModal        = false; break;
    case "close-add-challenge":   state.showAddChallengeModal = false; break;
    case "close-challenge-result": state.showChallengeResult  = null;  break;
  }
  render();
}
