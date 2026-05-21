import { en } from "./locales/en.js";
import { es } from "./locales/es.js";

const LOCALES = { en, es };

const browserLang = (navigator.language || "en").slice(0, 2).toLowerCase();
export const t = LOCALES[browserLang] ?? en;
