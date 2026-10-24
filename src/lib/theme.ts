export type ThemeChoice = "system" | "light" | "dark";

export const THEME_KEY = "studiskarte:theme";
export const THEME_EVENT = "studiskarte:theme";
const LIGHT = "#ffffff";
const DARK = "#0b101a";

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "system" || value === "light" || value === "dark";
}

/** Runs in <head> before the first paint: sets the `dark` class from the saved choice, else from the phone's setting. */
export const THEME_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(THEME_KEY)});var d=c==="dark"||(c!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";if(c==="dark"||c==="light"){var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].setAttribute("content",d?${JSON.stringify(DARK)}:${JSON.stringify(LIGHT)});}}catch(e){}})();`;

export function readTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return isThemeChoice(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

/** Saves the choice and applies it to the page now. */
export function applyTheme(choice: ThemeChoice): void {
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Storage blocked: the choice still applies until the page is closed.
  }
  const dark = choice === "dark" || (choice === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const systemDark = meta.media.includes("dark");
    meta.content = choice === "system" ? (systemDark ? DARK : LIGHT) : dark ? DARK : LIGHT;
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}
