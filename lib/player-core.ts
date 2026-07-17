export const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,29}$/;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function usernameFromDisplayName(displayName: string, suffix: string) {
  const base = displayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "").slice(0, 24) || "speler";
  const safeSuffix = suffix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-4).padStart(4, "0");
  return `${base}-${safeSuffix}`;
}
