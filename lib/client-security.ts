export function csrfToken() {
  return document.cookie.split("; ").find((value) => value.startsWith("fairway_csrf="))?.split("=").slice(1).join("=") || "";
}

export function secureHeaders(json = true) {
  return { ...(json ? { "content-type": "application/json" } : {}), "x-csrf-token": csrfToken() };
}
