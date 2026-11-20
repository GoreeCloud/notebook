/** Values are from the pinned GoreeCloud UI semantic token CSS, not new brand specifications. */
export const themeOptions=["system","light","dark"] as const;
export const accentOptions=["iris","lagoon","ember","moss"] as const;
export type ThemeMode=typeof themeOptions[number];
export type Accent=typeof accentOptions[number];

export function resolveTheme(mode:ThemeMode,prefersDark:boolean):"light"|"dark" {
  return mode==="system"?(prefersDark?"dark":"light"):mode;
}
export function preference<T extends string>(raw:string|null,choices:readonly T[],fallback:T):T {
  return raw!==null&&choices.includes(raw as T)?raw as T:fallback;
}
