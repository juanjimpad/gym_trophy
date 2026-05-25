export const BASE_EXERCISES = [
  "Press banca BB", "Press plano mancuernas", "Press militar BB", "Press militar DB",
  "Press inclinado DB", "Flexiones", "Jalón abierto al pecho", "Remo gironda",
  "Remo a una mano DB", "Jalón de bíceps", "Chin ups", "Peso muerto convencional BB",
  "Peso muerto rumano BB", "Peso muerto sumo BB", "Hip thrust BB",
  "Sentadilla búlgara", "Zancadas", "Split Squat", "Back Squat"
];

export const BANDS = [
  { id: "amarillo", color: "#F5C518", label: "Amarilla" },
  { id: "verde",    color: "#27AE60", label: "Verde"    },
  { id: "azul",     color: "#2980B9", label: "Azul"     },
  { id: "naranja",  color: "#E67E22", label: "Naranja"  },
];

export const CHALLENGE_DURATIONS = [
  { value: 30,  label: "30 seg" },
  { value: 60,  label: "1 min"  },
  { value: 120, label: "2 min"  },
  { value: 300, label: "5 min"  },
];

export function safeKey(n) { return n.replace(/[.#$[\]/\s"'<>]/g, "_"); }
export const CHIN_KEY = safeKey("Chin ups");

export const IS_DEV = ['localhost', '127.0.0.1', ''].includes(location.hostname);
