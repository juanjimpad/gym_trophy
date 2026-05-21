import { state }                          from "./state.js";
import { BASE_EXERCISES, BANDS, CHALLENGE_DURATIONS, safeKey, CHIN_KEY } from "./config.js";
import {
  allExNames, getInitials, formatDate, formatDuration, formatDateStr,
  formatMetricValue, metricLabel, metricUnit, isChallengeActive, isChallengeStarted,
  getLeaderboard, getTopEntry, bandLabel, bandColor, medalEmoji, todayStr, calcAge,
} from "./utils.js";
import { t } from "./i18n.js";

// ── HTML escape — apply to ALL user-supplied strings before innerHTML ──────────
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────

export function showToast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

export function showSaving() {
  const el = document.getElementById("savingIndicator");
  if (!el) return;
  el.textContent = t.saved;
  el.classList.remove("error");
  el.classList.add("show");
  clearTimeout(state.savingTimer);
  state.savingTimer = setTimeout(() => el.classList.remove("show"), 1600);
}

export function showSaveError(msg) {
  msg = msg ?? t.saveError;
  // Toast rojo
  const toast = document.getElementById("toast");
  if (toast) {
    toast.textContent = "⚠ " + msg;
    toast.classList.add("show", "toast-error");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      toast.classList.remove("show", "toast-error");
    }, 4000);
  }
  // Indicador en header si existe
  const el = document.getElementById("savingIndicator");
  if (!el) return;
  el.textContent = t.notSaved;
  el.classList.add("show", "error");
  clearTimeout(state.savingTimer);
  state.savingTimer = setTimeout(() => el.classList.remove("show", "error"), 4000);
}

function dotHtml() {
  return `<span class="status-dot${state.isOnline ? " online" : ""}" id="statusDot"></span>`;
}

function header(left, center, right = "") {
  const offlineBanner = !state.isOnline
    ? `<div class="offline-banner">${t.offline}</div>`
    : "";
  return `
    <div class="header">
      ${left}
      <p class="title">${center}</p>
      ${right}
    </div>
    ${offlineBanner}`;
}

// ── Login ─────────────────────────────────────────────────────────────────────

export function renderLogin() {
  if (!state.isOnline) {
    return `
      <div class="login-screen">
        <div class="login-card">
          <div class="login-logo">🏋️</div>
          <div class="login-title">🏆 Gym Trophy</div>
          <div class="login-error">${t.offline}</div>
        </div>
      </div>`;
  }
  const error = state.loginError
    ? `<div class="login-error">${state.loginError}</div>`
    : "";
  return `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-logo">🏋️</div>
        <div class="login-title">🏆 Gym Trophy</div>
        <div class="login-subtitle">${t.loginSubtitle}</div>
        <input class="modal-input" id="loginEmail"    type="email"    placeholder="${t.loginEmailPh}" autocomplete="email"     inputmode="email">
        <input class="modal-input" id="loginPassword" type="password" placeholder="${t.loginPasswordPh}"         autocomplete="current-password">
        ${error}
        <button class="btn-save" id="loginBtn" data-action="login">${t.loginBtn}</button>
      </div>
    </div>`;
}

// ── Home ──────────────────────────────────────────────────────────────────────

function renderHome() {
  const clientCount  = Object.keys(state.clients).length;
  const clientsPanel = state.showClientsPanel  ? renderClientsPanel()  : "";
  const addModal     = state.showAddClientModal ? renderAddClientModal() : "";
  const editModal    = state.showEditClientModal ? renderEditClientModal() : "";
  const accessPanel  = state.showAccessPanel   ? renderAccessPanel()   : "";

  return `
    ${header(
      `<div class="header-dot">${dotHtml()}<span class="app-name">🏆 Gym Trophy</span></div>`,
      "",
      `<div class="header-right">
        <button class="btn-icon" data-action="open-access-panel" title="${t.infoPanelTitle}">ℹ</button>
        <button class="btn-icon btn-logout" data-action="logout" title="${t.logoutConfirm}">↩</button>
      </div>`
    )}
    <div class="content home-content">
      <button class="category-card card-challenges" data-action="go-challenges">
        <div class="category-icon">🏆</div>
        <div class="category-body">
          <div class="category-title">${t.homeChallengesTitle}</div>
          <div class="category-desc">${t.homeChallengesDesc}</div>
        </div>
        <span class="category-arrow">›</span>
      </button>

      <button class="category-card card-weights" data-action="go-weights">
        <div class="category-icon">🏋️</div>
        <div class="category-body">
          <div class="category-title">${t.homeWeightsTitle}</div>
          <div class="category-desc">${t.homeWeightsDesc}</div>
        </div>
        <span class="category-arrow">›</span>
      </button>

      <button class="category-card card-clients" data-action="open-clients-panel">
        <div class="category-icon">👥</div>
        <div class="category-body">
          <div class="category-title">${t.homeClientsTitle}</div>
          <div class="category-desc">${t.homeClientsDesc}</div>
        </div>
        <span class="category-arrow">›</span>
      </button>

    </div>
    ${clientsPanel}${addModal}${editModal}${accessPanel}`;
}

// ── Access panel ─────────────────────────────────────────────────────────────

function renderAccessPanel() {
  return `
    <div class="panel-bg panel-bg-center" data-action="close-access-panel">
      <div class="panel panel-centered" id="accessPanel">
        <div class="panel-header">
          <span class="panel-title">${t.infoPanelTitle}</span>
          <button class="btn-sm" data-action="close-access-panel">${t.close}</button>
        </div>
        <div class="panel-body">

          <div class="info-about">
            <div class="info-logo">🏆</div>
            <p class="info-about-text">${t.infoAboutText}</p>
            <div class="info-badges">
              <a class="home-badge" href="https://github.com/juanjimpad/gym_trophy/blob/main/LICENSE" target="_blank" rel="noopener">${t.badgeNonCommercial}</a>
              <a class="home-badge home-badge-ai" href="https://claude.ai" target="_blank" rel="noopener">${t.badgeAI}</a>
              <a class="home-badge home-badge-gh" href="https://github.com/juanjimpad/gym_trophy" target="_blank" rel="noopener">${t.badgeGH}</a>
            </div>
            <a class="home-kofi" href="https://ko-fi.com/juanjimpad" target="_blank" rel="noopener">${t.kofiBtn}</a>
          </div>

          <div class="access-divider"></div>

          <div class="access-section-title">${t.contactTitle}</div>
          <p class="access-hint">${t.contactHint}</p>
          <div style="text-align:center">
            <a class="btn-contact" href="mailto:juanjimpad@gmail.com?subject=Gym%20Trophy%20-%20Feedback">${t.contactBtn}</a>
          </div>

        </div>
      </div>
    </div>`;
}

// ── Clients panel (overlay) ───────────────────────────────────────────────────

function renderClientsPanel() {
  const q      = state.clientsSearch.trim().toLowerCase();
  const all    = Object.entries(state.clients).sort((a, b) => a[1].name.localeCompare(b[1].name));
  const sorted = q ? all.filter(([, c]) => c.name.toLowerCase().includes(q)) : all;

  const rows = all.length === 0
    ? `<div class="empty-panel">${t.clientsEmpty}</div>`
    : sorted.length === 0
      ? `<div class="empty-panel">${t.clientsNoResults}</div>`
      : sorted.map(([k, c]) => `
          <div class="panel-client-row">
            <div class="avatar">${esc(getInitials(c.name))}</div>
            <span class="panel-client-name">${esc(c.name)}</span>
            <div class="panel-client-actions">
              <button class="btn-sm btn-blue" data-action="edit-client" data-key="${k}">${t.edit}</button>
              <button class="btn-sm btn-red"  data-action="delete-client" data-key="${k}">${t.delete}</button>
            </div>
          </div>`).join("");

  return `
    <div class="panel-bg" data-action="close-clients-panel">
      <div class="panel" id="clientsPanel">
        <div class="panel-header">
          <span class="panel-title">${t.clientsPanelTitle}</span>
          <button class="btn-sm btn-green" data-action="open-add-client">${t.clientsAddBtn}</button>
        </div>
        <div class="panel-search">
          <input class="search-input" id="clientsSearch" type="search"
            placeholder="${t.clientsSearchPh}" value="${esc(state.clientsSearch)}" autocomplete="off">
        </div>
        <div class="panel-body">${rows}</div>
      </div>
    </div>`;
}

function renderAddClientModal() {
  return `
    <div class="modal-bg" data-action="close-add-client">
      <div class="modal" id="addClientModal">
        <div class="modal-title">${t.newClientTitle}</div>
        <input class="modal-input" id="newClientInput" placeholder="${t.newClientNamePh}" autocomplete="off">
        <div class="metric-selector">
          <label class="metric-opt">
            <input type="radio" name="newClientSex" value="" checked>
            <span class="metric-opt-icon">👤</span>
            <span>${t.sexNone}</span>
          </label>
          <label class="metric-opt">
            <input type="radio" name="newClientSex" value="male">
            <span class="metric-opt-icon">👨</span>
            <span>${t.sexMaleLabel}</span>
          </label>
          <label class="metric-opt">
            <input type="radio" name="newClientSex" value="female">
            <span class="metric-opt-icon">👩</span>
            <span>${t.sexFemaleLabel}</span>
          </label>
        </div>
        <label class="date-label" style="display:block;margin-bottom:6px">${t.birthDateLabel}</label>
        <input type="date" class="modal-input" id="newClientBirthDate">
        <div class="modal-actions">
          <button class="btn-cancel" data-action="close-add-client">${t.cancel}</button>
          <button class="btn-confirm" data-action="confirm-add-client">${t.add}</button>
        </div>
      </div>
    </div>`;
}

function renderEditClientModal() {
  const c         = state.clients[state.selectedClientKey] ?? {};
  const name      = c.name      ?? "";
  const sex       = c.sex       ?? "";
  const birthDate = c.birthDate ?? "";
  const sexOpts   = [
    { value: "",       icon: "👤", label: t.sexNone      },
    { value: "male",   icon: "👨", label: t.sexMaleLabel  },
    { value: "female", icon: "👩", label: t.sexFemaleLabel },
  ].map(o => `
    <label class="metric-opt">
      <input type="radio" name="editClientSex" value="${o.value}"${sex === o.value ? " checked" : ""}>
      <span class="metric-opt-icon">${o.icon}</span>
      <span>${o.label}</span>
    </label>`).join("");
  return `
    <div class="modal-bg" data-action="close-edit-client">
      <div class="modal" id="editClientModal">
        <div class="modal-title">${t.editClientTitle}</div>
        <input class="modal-input" id="editClientInput" value="${esc(name)}" autocomplete="off">
        <div class="metric-selector">${sexOpts}</div>
        <label class="date-label" style="display:block;margin-bottom:6px">${t.birthDateLabel}</label>
        <input type="date" class="modal-input" id="editClientBirthDate" value="${birthDate}">
        <div class="modal-actions">
          <button class="btn-cancel" data-action="close-edit-client">${t.cancel}</button>
          <button class="btn-confirm" data-action="confirm-edit-client">${t.save}</button>
        </div>
      </div>
    </div>`;
}

// ── Weights: exercise list ────────────────────────────────────────────────────

function renderWeightsList() {
  const addExModal = state.showAddExModal ? renderAddExModal() : "";
  const names = allExNames();

  const cards = names.map(name => {
    const k   = safeKey(name);
    const top = getTopEntry(k);
    let topBadge = `<span class="no-record">${t.noRecordsYet}</span>`;
    if (top) {
      const isChin = k === CHIN_KEY;
      const val    = isChin ? `${top.value} reps` : `${top.value === 0 ? t.bodyweightShort : top.value + " kg"}`;
      topBadge     = `<span class="top-badge">👑 ${esc(top.name)} · ${val}</span>`;
    }
    return `
      <div class="ex-list-row" data-action="go-leaderboard" data-exk="${k}">
        <div class="ex-list-info">
          <span class="ex-list-name">${esc(name)}</span>
          ${topBadge}
        </div>
        <span class="ex-list-arrow">›</span>
      </div>`;
  }).join("");

  return `
    ${header(
      `<button class="btn-back" data-action="go-home">${t.backHome}</button>`,
      t.weightsTitle,
      `<button class="btn-sm btn-blue" data-action="open-add-ex">${t.addExBtn}</button>`
    )}
    <div class="content">${cards}</div>
    ${addExModal}`;
}

function renderAddExModal() {
  return `
    <div class="modal-bg" data-action="close-add-ex">
      <div class="modal">
        <div class="modal-title">${t.newExTitle}</div>
        <input class="modal-input" id="newExInput" placeholder="${t.newExPh}" autocomplete="off">
        <div class="modal-actions">
          <button class="btn-cancel" data-action="close-add-ex">${t.cancel}</button>
          <button class="btn-confirm" data-action="confirm-add-ex">${t.addForAll}</button>
        </div>
      </div>
    </div>`;
}

// ── Weights: leaderboard ──────────────────────────────────────────────────────

function lbWeightRow(entry, rank, isChin, clickable = true) {
  let valueStr;
  if (entry.value === null) {
    valueStr = `<span class="no-record-sm">${t.noRecord}</span>`;
  } else if (isChin) {
    valueStr = `${entry.value} reps`;
  } else {
    valueStr = entry.value === 0 ? t.bodyweight : `${entry.value} kg`;
  }
  const dateStr = entry.ts ? `· ${formatDate(entry.ts)}` : "";
  const medal   = rank ? `<span class="medal">${medalEmoji(rank)}</span>` : `<span class="medal rank-none">—</span>`;
  const age     = calcAge(entry.birthDate);
  const ageStr  = age !== null ? `<span class="lb-age">${age} ${t.ageUnit}</span>` : "";
  const action  = clickable ? `data-action="go-session" data-client="${entry.clientKey}"` : "";
  return `
    <div class="leaderboard-row${rank === 1 ? " rank-gold" : rank === 2 ? " rank-silver" : rank === 3 ? " rank-bronze" : ""}" ${action}>
      ${medal}
      <div class="lb-info">
        <div class="lb-name-row"><span class="lb-name">${esc(entry.name)}</span>${ageStr}</div>
        <span class="lb-value">${valueStr} <span class="lb-date">${dateStr}</span></span>
      </div>
      ${clickable ? `<span class="lb-arrow">›</span>` : ""}
    </div>`;
}

// hasRecord: fn(entry) → bool — distingue quién tiene marca vs quién no
function renderSexGroups(board, rowFn, hasRecord = (e) => e.value !== null) {
  const withMark    = board.filter(e =>  hasRecord(e));
  const withoutMark = board.filter(e => !hasRecord(e));

  const hasSex = withMark.some(e => e.sex === "male" || e.sex === "female");

  const section = (label, entries) => {
    if (!entries.length) return "";
    const rows = entries.map((e, i) => rowFn(e, i + 1)).join("");
    return `<div class="sex-section-label">${label}</div>${rows}`;
  };

  let ranked = "";
  if (!hasSex) {
    ranked = withMark.map((e, i) => rowFn(e, i + 1)).join("");
  } else {
    const male    = withMark.filter(e => e.sex === "male");
    const female  = withMark.filter(e => e.sex === "female");
    const unknown = withMark.filter(e => e.sex !== "male" && e.sex !== "female");
    ranked = section(t.sexMaleGroup, male) + section(t.sexFemaleGroup, female) + section(t.sexUnknownGroup, unknown);
  }

  const noMark = withoutMark.length
    ? `<div class="sex-section-label">${t.noMark}</div>` + withoutMark.map(e => rowFn(e, null)).join("")
    : "";

  return ranked + noMark;
}

function renderWeightsLeaderboard() {
  const exKey  = state.selectedExKey;
  const exName = allExNames().find(n => safeKey(n) === exKey) ?? exKey;
  const board  = getLeaderboard(exKey);
  const isChin = exKey === CHIN_KEY;

  const rows  = renderSexGroups(board, (e, rank) => lbWeightRow(e, rank, isChin, true));
  const empty = board.length === 0
    ? `<div class="empty">${t.noClientsLeaderboard}</div>`
    : "";

  return `
    ${header(
      `<button class="btn-back" data-action="go-weights-list">${t.backWeights}</button>`,
      esc(exName)
    )}
    <div class="content">
      <div class="section-label">${t.bestRecord}</div>
      ${rows}${empty}
    </div>`;
}

// ── Session (client exercise editing) ────────────────────────────────────────

function renderSession() {
  const clientKey      = state.selectedClientKey;
  const c              = state.clients[clientKey];
  const fromLeaderboard = state.sessionOrigin === "leaderboard";
  const addExModal     = state.showAddExModal ? renderAddExModal() : "";

  const backAction = fromLeaderboard ? "go-leaderboard" : "go-home";
  const backLabel  = fromLeaderboard
    ? `‹ ${esc(allExNames().find(n => safeKey(n) === state.selectedExKey) ?? t.backHome)}`
    : t.backHome;

  let cards;
  if (fromLeaderboard) {
    // Solo muestra el ejercicio seleccionado desde el leaderboard
    const exName   = allExNames().find(n => safeKey(n) === state.selectedExKey);
    const isCustom = exName ? !BASE_EXERCISES.includes(exName) : false;
    cards = exName ? exCard(exName, c, isCustom) : "";
  } else {
    // Muestra todos los ejercicios (acceso desde el panel de clientes)
    const baseCards   = BASE_EXERCISES.map(n => exCard(n, c, false)).join("");
    const customNames = Object.values(state.customExercises).map(e => e.name);
    const customCards = customNames.length
      ? `<div class="section-label">${t.customExSection}</div>` + customNames.map(n => exCard(n, c, true)).join("")
      : "";
    cards = baseCards + customCards;
  }

  return `
    ${header(
      `<button class="btn-back" data-action="${backAction}">${backLabel}</button>`,
      esc(c.name),
      `<span class="saving" id="savingIndicator"></span>`
    )}
    <div class="content">
      ${cards}
      ${!fromLeaderboard ? `<button class="add-ex-btn" data-action="open-add-ex">${t.addExForAllBtn}</button>` : ""}
      <button class="btn-save" data-action="save-session" data-client="${clientKey}">
        ${t.saveSessionBtn}
      </button>
    </div>
    ${addExModal}`;
}

function exCard(exName, c, isCustom) {
  const k   = safeKey(exName);
  const ex  = c.exercises[k] ?? { weight: 0, reps: 10, sets: 3 };
  const w   = ex.weight ?? 0;
  const r   = ex.reps   ?? 10;
  const s   = ex.sets   ?? 3;
  const cls = isCustom ? "ex-name-custom" : "ex-name-btn";

  let topRow;
  if (k === CHIN_KEY) {
    const cur     = ex.band ?? null;
    const circles = BANDS.map(b =>
      `<button class="band-circle${cur === b.id ? " active" : ""}"
         style="background:${b.color}" data-action="set-band" data-exk="${k}" data-band="${b.id}"
         title="${b.label}"></button>`).join("");
    topRow = `
      <div class="ctrl-row">
        <span class="ctrl-label">${t.bandCtrlLabel}</span>
        <div class="band-row">
          <button class="band-none-btn${!cur ? " active" : ""}" data-action="set-band" data-exk="${k}" data-band="">${t.noBand}</button>
          ${circles}
        </div>
      </div>`;
  } else {
    topRow = `
      <div class="ctrl-row">
        <span class="ctrl-label">${t.weightCtrlLabel}</span>
        <button class="ctrl-btn" data-action="adj" data-exk="${k}" data-field="weight" data-delta="-1">−</button>
        <input type="number" class="num-input" value="${w}" min="0" step="0.5"
          data-exk="${k}" data-field="weight" inputmode="decimal">
        <span class="ctrl-unit">${t.kgUnit}</span>
        <button class="ctrl-btn" data-action="adj" data-exk="${k}" data-field="weight" data-delta="1">+</button>
      </div>`;
  }

  return `
    <div class="ex-card">
      <button class="${cls}" data-action="go-exercise-history" data-exk="${k}">${t.exHistoryOf} ${esc(exName)} ›</button>
      ${topRow}
      <div class="ctrl-row">
        <span class="ctrl-label">${t.repsCtrlLabel}</span>
        <button class="ctrl-btn" data-action="adj" data-exk="${k}" data-field="reps" data-delta="-1">−</button>
        <input type="number" class="num-input" value="${r}" min="0" step="1"
          data-exk="${k}" data-field="reps" inputmode="numeric">
        <button class="ctrl-btn" data-action="adj" data-exk="${k}" data-field="reps" data-delta="1">+</button>
      </div>
      <div class="ctrl-row">
        <span class="ctrl-label">${t.setsCtrlLabel}</span>
        <button class="ctrl-btn" data-action="adj" data-exk="${k}" data-field="sets" data-delta="-1">−</button>
        <input type="number" class="num-input" value="${s}" min="0" step="1"
          data-exk="${k}" data-field="sets" inputmode="numeric">
        <button class="ctrl-btn" data-action="adj" data-exk="${k}" data-field="sets" data-delta="1">+</button>
      </div>
    </div>`;
}

// ── Exercise history ──────────────────────────────────────────────────────────

function renderExerciseHistory() {
  const clientKey = state.selectedClientKey;
  const exKey     = state.selectedExKey;
  const c         = state.clients[clientKey];
  const exName    = allExNames().find(n => safeKey(n) === exKey) ?? exKey;
  const isChin    = exKey === CHIN_KEY;
  const raw       = c.history?.[exKey] ?? {};
  const entries   = Object.entries(raw).sort((a, b) => a[0].localeCompare(b[0]));

  let chartSection = "";
  if (!isChin && entries.length >= 2) {
    chartSection = `
      <div class="history-section">
        <div class="history-title">${t.weightEvolution}</div>
        <div class="chart-wrap"><canvas id="progressChart"></canvas></div>
      </div>`;
    setTimeout(() => {
      if (state.chartInstance) { state.chartInstance.destroy(); state.chartInstance = null; }
      const canvas = document.getElementById("progressChart");
      if (!canvas) return;
      state.chartInstance = new Chart(canvas, {
        type: "line",
        data: {
          labels:   entries.map(([, v]) => formatDate(v.ts)),
          datasets: [{ data: entries.map(([, v]) => v.weight || 0), borderColor: "#1D9E75",
            backgroundColor: "rgba(29,158,117,0.08)", borderWidth: 2.5,
            pointBackgroundColor: "#1D9E75", pointRadius: 5, tension: 0.3, fill: true }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 12 }, color: "#8e8e93" } },
            y: { grid: { color: "#f0f0f0" }, ticks: { font: { size: 12 }, color: "#8e8e93" } }
          }
        }
      });
    }, 60);
  }

  const listRows = entries.length === 0
    ? `<div class="no-history">${t.noHistory}</div>`
    : [...entries].reverse().map(([dateKey, v]) => {
        let vals;
        if (isChin) {
          const bc  = v.band ? bandColor(v.band) : null;
          const dot = bc ? `<span class="band-dot" style="background:${bc}"></span>` : "";
          vals = `${dot}${v.band ? bandLabel(v.band) : t.noBandHistory} · ${v.reps} reps · ${v.sets} series`;
        } else {
          vals = `${v.weight === 0 ? t.bodyweightShort : (v.weight || 0) + " kg"} · ${v.reps} reps · ${v.sets} series`;
        }
        return `
          <div class="history-row">
            <div class="history-row-left">
              <span class="history-date">${formatDate(v.ts)}</span>
              <span class="history-vals">${vals}</span>
            </div>
            <button class="btn-history-delete" data-action="delete-session"
              data-client="${clientKey}" data-exk="${exKey}" data-datekey="${dateKey}"
              title="${t.deleteSession}">✕</button>
          </div>`;
      }).join("");

  return `
    ${header(
      `<button class="btn-back" data-action="go-back-session">‹ ${esc(c.name)}</button>`,
      esc(exName)
    )}
    <div class="content">
      ${chartSection}
      <div class="history-section">
        <div class="history-title">${t.sessionHistory}</div>
        <div class="history-list">${listRows}</div>
      </div>
    </div>`;
}

// ── Challenges: list ──────────────────────────────────────────────────────────

function renderChallengesList() {
  const addModal = state.showAddChallengeModal ? renderAddChallengeModal() : "";
  const sorted   = Object.entries(state.challenges).sort((a, b) => b[1].createdAt - a[1].createdAt);

  const cards = sorted.length === 0
    ? `<div class="empty">${t.challengesEmpty}</div>`
    : sorted.map(([k, ch]) => {
        const active   = isChallengeActive(ch);
        const started  = isChallengeStarted(ch);
        const results  = ch.results ?? {};
        const isTime   = ch.metric === "time";
        const vals     = Object.entries(results).map(([, r]) => r.value);
        const topVal   = vals.length ? (isTime ? Math.min(...vals) : Math.max(...vals)) : null;
        const topCk    = topVal !== null ? Object.keys(results).find(ck => results[ck].value === topVal) : null;
        const topName  = topCk ? (state.clients[topCk]?.name ?? "—") : null;

        const leaderBadge = topName
          ? `<span class="top-badge">👑 ${esc(topName)} · ${formatMetricValue(topVal, ch.metric)}</span>`
          : `<span class="no-record">${t.noResultsYet}</span>`;

        const dateRange = (ch.startDate || ch.endDate)
          ? `<span class="challenge-dates">${ch.startDate ? formatDateStr(ch.startDate) : "?"} → ${ch.endDate ? formatDateStr(ch.endDate) : "∞"}</span>`
          : "";

        const statusBadge = !started
          ? `<span class="ch-badge ch-badge-pending">${t.badgePending}</span>`
          : active
            ? `<span class="ch-badge ch-badge-active">${t.badgeActive}</span>`
            : `<span class="ch-badge ch-badge-finished">${t.badgeFinished}</span>`;

        return `
          <div class="challenge-card${!active ? " challenge-inactive" : ""}" data-action="go-challenge" data-key="${k}">
            <div class="challenge-card-inner">
              <div class="challenge-card-header">
                <div class="challenge-name-row">
                  <span class="challenge-name">${esc(ch.name)}</span>
                  ${statusBadge}
                </div>
                <span class="challenge-meta">${ch.exerciseName ? esc(ch.exerciseName) + " · " : ""}${metricLabel(ch.metric)}${ch.duration ? " · " + formatDuration(ch.duration) : ""} ${dateRange}</span>
              </div>
              ${leaderBadge}
            </div>
            <span class="ex-list-arrow">›</span>
          </div>`;
      }).join("");

  return `
    ${header(
      `<button class="btn-back" data-action="go-home">${t.backHome}</button>`,
      t.challengesTitle,
      `<button class="btn-sm btn-green" data-action="open-add-challenge">${t.addChallengeBtn}</button>`
    )}
    <div class="content">${cards}</div>
    ${addModal}`;
}

function renderAddChallengeModal() {
  const today      = todayStr();
  const exOptions  = `<option value="">${t.noExercise}</option>` + allExNames().map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
  const durOptions = `<option value="">${t.noTime}</option>` + CHALLENGE_DURATIONS.map(d => `<option value="${d.value}">${d.label}</option>`).join("");

  return `
    <div class="modal-bg" data-action="close-add-challenge">
      <div class="modal modal-lg">
        <div class="modal-title">${t.newChallengeTitle}</div>

        <input class="modal-input" id="challengeNameInput" placeholder="${t.challengeNamePh}" autocomplete="off">

        <div class="metric-selector">
          <label class="metric-opt">
            <input type="radio" name="challengeMetric" value="reps" checked>
            <span>${t.metricReps}</span>
          </label>
          <label class="metric-opt">
            <input type="radio" name="challengeMetric" value="cal">
            <span>${t.metricCal}</span>
          </label>
          <label class="metric-opt">
            <input type="radio" name="challengeMetric" value="time">
            <span>${t.metricTime}</span>
          </label>
        </div>

        <select class="modal-input modal-select" id="challengeExInput">${exOptions}</select>
        <select class="modal-input modal-select" id="challengeDurationInput">${durOptions}</select>

        <div class="date-row">
          <div class="date-field">
            <label class="date-label">${t.startDateLabel}</label>
            <input type="date" class="modal-input" id="challengeStartDate" value="${today}" min="${today}">
          </div>
          <div class="date-field">
            <label class="date-label">${t.endDateLabel}</label>
            <input type="date" class="modal-input" id="challengeEndDate" min="${today}">
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn-cancel" data-action="close-add-challenge">${t.cancel}</button>
          <button class="btn-confirm" data-action="confirm-add-challenge">${t.createChallengeBtn}</button>
        </div>
      </div>
    </div>`;
}

// ── Challenge: detail / leaderboard ──────────────────────────────────────────

function renderChallengeDetail() {
  const key    = state.selectedChallengeKey;
  const ch     = state.challenges[key];
  if (!ch) return renderChallengesList();

  const active  = isChallengeActive(ch);
  const isTime  = ch.metric === "time";
  const results = ch.results ?? {};

  // For time metric: lower = better (ascending); others: higher = better (descending)
  const clientsSorted = Object.entries(state.clients)
    .map(([ck, c]) => ({ clientKey: ck, name: c.name, sex: c.sex ?? null, birthDate: c.birthDate ?? null, entry: results[ck] ?? null }))
    .sort((a, b) => {
      if (!a.entry && !b.entry) return a.name.localeCompare(b.name);
      if (!a.entry) return 1;
      if (!b.entry) return -1;
      return isTime ? a.entry.value - b.entry.value : b.entry.value - a.entry.value;
    });

  const resultModal = state.showChallengeResult
    ? renderChallengeResultModal(key, state.showChallengeResult, ch.metric)
    : "";

  const inactiveBanner = !active
    ? `<div class="finished-banner">${t.challengeFinishedBanner}</div>`
    : "";

  const chRowFn = (item, rank) => {
    const valStr    = item.entry ? formatMetricValue(item.entry.value, ch.metric) : `<span class="no-record-sm">${t.noResultSm}</span>`;
    const dateStr   = item.entry ? `· ${formatDate(item.entry.ts)}` : "";
    const medal     = rank ? `<span class="medal">${medalEmoji(rank)}</span>` : `<span class="medal rank-none">—</span>`;
    const age       = calcAge(item.birthDate);
    const ageStr    = age !== null ? `<span class="lb-age">${age} ${t.ageUnit}</span>` : "";
    const actionBtn = active
      ? `<button class="btn-sm btn-blue" data-action="open-challenge-result" data-client="${item.clientKey}">${item.entry ? t.editResult : t.addResult}</button>`
      : "";
    return `
      <div class="leaderboard-row${rank === 1 ? " rank-gold" : rank === 2 ? " rank-silver" : rank === 3 ? " rank-bronze" : ""}">
        ${medal}
        <div class="lb-info">
          <div class="lb-name-row"><span class="lb-name">${esc(item.name)}</span>${ageStr}</div>
          <span class="lb-value">${valStr} <span class="lb-date">${dateStr}</span></span>
        </div>
        ${actionBtn}
      </div>`;
  };

  const rows = clientsSorted.length === 0
    ? `<div class="empty">${t.noClientsChallenge}</div>`
    : renderSexGroups(clientsSorted, chRowFn, (e) => e.entry !== null);

  const dateInfo = (ch.startDate || ch.endDate)
    ? `<span class="challenge-info-item">📅 ${ch.startDate ? formatDateStr(ch.startDate) : "?"} → ${ch.endDate ? formatDateStr(ch.endDate) : "∞"}</span>`
    : "";

  return `
    ${header(
      `<button class="btn-back" data-action="go-challenges-list">${t.backChallenges}</button>`,
      esc(ch.name),
      `<button class="btn-sm btn-red" data-action="delete-challenge" data-key="${key}">${t.delete}</button>`
    )}
    <div class="content">
      ${inactiveBanner}
      <div class="challenge-info-bar">
        ${ch.exerciseName ? `<span class="challenge-info-item">📋 ${esc(ch.exerciseName)}</span>` : ""}
        <span class="challenge-info-item">📊 ${metricLabel(ch.metric)}</span>
        ${ch.duration ? `<span class="challenge-info-item">⏱ ${formatDuration(ch.duration)}</span>` : ""}
        ${dateInfo}
      </div>
      <div class="section-label">${t.ranking}</div>
      ${rows}
    </div>
    ${resultModal}`;
}

function renderChallengeResultModal(challengeKey, clientKey, metric) {
  const clientName = state.clients[clientKey]?.name ?? "";
  const existing   = state.challenges[challengeKey]?.results?.[clientKey]?.value ?? "";
  const unit       = metricUnit(metric ?? "reps");
  return `
    <div class="modal-bg" data-action="close-challenge-result">
      <div class="modal">
        <div class="modal-title">${esc(clientName)}</div>
        <input type="number" class="modal-input" id="challengeResultInput"
          value="${existing}" placeholder="${t.resultPh(unit)}" inputmode="decimal" min="0">
        <div class="modal-actions">
          <button class="btn-cancel" data-action="close-challenge-result">${t.cancel}</button>
          <button class="btn-confirm" data-action="confirm-challenge-result"
            data-challenge="${challengeKey}" data-client="${clientKey}">${t.save}</button>
        </div>
      </div>
    </div>`;
}

// ── Global footer ─────────────────────────────────────────────────────────────

function appFooter() {
  return `
    <div class="app-footer">
      ${t.footerName}
      <a class="app-footer-link" href="https://github.com/juanjimpad/gym_trophy" target="_blank" rel="noopener noreferrer">
        <svg class="app-footer-gh" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
        GitHub
      </a>
    </div>`;
}

// ── Main render dispatcher ────────────────────────────────────────────────────

export function render() {
  const app = document.getElementById("app");
  let html;

  if (!state.currentUser || !state.isOnline) {
    html = renderLogin();
  } else {
    switch (state.view) {
      case "home":                html = renderHome();               break;
      case "weights-list":        html = renderWeightsList();        break;
      case "weights-leaderboard": html = renderWeightsLeaderboard(); break;
      case "session":             html = renderSession();            break;
      case "exercise-history":    html = renderExerciseHistory();    break;
      case "challenges-list":     html = renderChallengesList();     break;
      case "challenge-detail":    html = renderChallengeDetail();    break;
      default:                    html = renderHome();
    }
    html += appFooter();
  }

  app.innerHTML = html;
  focusModal();
}

function focusModal() {
  const targets = ["loginEmail","newClientInput","editClientInput","newExInput","challengeNameInput","challengeResultInput"];
  for (const id of targets) {
    const el = document.getElementById(id);
    if (el) { el.focus(); if (el.type !== "number") el.select?.(); break; }
  }
}
