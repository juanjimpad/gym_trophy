export const state = {
  // Firebase data
  clients:          {},
  customExercises:  {},
  challenges:       {},
  isOnline:         true,

  // Navigation
  // Possible values: home | weights-list | weights-leaderboard | session |
  //                  exercise-history | challenges-list | challenge-detail
  view:             "home",
  sessionOrigin:    "leaderboard", // "leaderboard" | "clients-panel"

  // Selected items
  selectedClientKey:    null,
  selectedExKey:        null,
  selectedChallengeKey: null,

  // Modal/overlay visibility
  showClientsPanel:     false,
  showAddClientModal:   false,
  showEditClientModal:  false,
  showAddExModal:       false,
  showAddChallengeModal:false,
  showChallengeResult:  null, // clientKey being edited, or null

  // Auth
  currentUser:       null,
  loginError:        null,
  showAccessPanel:   false,
  accessError:       null,
  accessSuccess:     false,

  // UI helpers
  chartInstance: null,
  savingTimer:   null,
  toastTimer:    null,
};
