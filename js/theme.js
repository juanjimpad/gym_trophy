const KEY = "gym_trophy_theme";
const mq  = window.matchMedia("(prefers-color-scheme: dark)");

export function getTheme() {
  return localStorage.getItem(KEY) ?? "auto";
}

export function setTheme(theme) {
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme) {
  const dark = theme === "dark" || (theme === "auto" && mq.matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

export function initTheme() {
  applyTheme(getTheme());
  mq.addEventListener("change", () => {
    if (getTheme() === "auto") applyTheme("auto");
  });
}
