const AUTH = "https://id.grudge-studio.com";
const TOKEN_KEY = "grudge_auth_token";
const ID_KEY = "grudge_id";

export function session() {
  return {
    token: localStorage.getItem(TOKEN_KEY) || "",
    grudgeId: localStorage.getItem(ID_KEY) || "",
    signedIn: Boolean(localStorage.getItem(TOKEN_KEY)),
  };
}

export function ingest() {
  const url = new URL(location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const token =
    hash.get("sso_token") ||
    hash.get("grudge_token") ||
    hash.get("token") ||
    url.searchParams.get("sso_token") ||
    url.searchParams.get("grudge_token") ||
    url.searchParams.get("token");
  const id =
    hash.get("grudge_id") ||
    hash.get("grudgeId") ||
    url.searchParams.get("grudge_id") ||
    url.searchParams.get("grudgeId");
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (id) localStorage.setItem(ID_KEY, id);
  if (token || id) {
    for (const key of ["sso_token", "grudge_token", "token", "grudge_id", "grudgeId", "username", "grudge_username"]) {
      url.searchParams.delete(key);
    }
    history.replaceState(null, "", url.pathname + url.search + "#/");
  }
}

export function startLogin() {
  const back = location.origin + location.pathname;
  const u = new URL(AUTH + "/login");
  u.searchParams.set("redirect_uri", back);
  u.searchParams.set("app", "build-a-grudge");
  location.href = u.toString();
}

export function signOut() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ID_KEY);
}
