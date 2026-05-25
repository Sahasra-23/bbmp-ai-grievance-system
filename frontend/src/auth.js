export const TOKEN_KEY = "bbmp_token";

export function saveToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getTokenPayload(token = getToken()) {
  if (!token) {
    return null;
  }

  try {
    const payload = token.split(".")[1];
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(window.atob(normalizedPayload));
  } catch {
    return null;
  }
}

export function isTokenExpired(token = getToken()) {
  const payload = getTokenPayload(token);

  if (!payload?.exp) {
    return false;
  }

  return payload.exp * 1000 <= Date.now();
}

export function getValidToken() {
  const token = getToken();

  if (token && isTokenExpired(token)) {
    clearToken();
    return null;
  }

  return token;
}

export function isAuthenticated() {
  return Boolean(getValidToken());
}
