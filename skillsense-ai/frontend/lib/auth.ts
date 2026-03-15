// frontend/lib/auth.ts
// Token helpers — abstracted so we only touch localStorage in one place.
// Tokens are also mirrored to cookies so Next.js edge middleware can read them.

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const COOKIE_TOKEN_KEY = 'skillsense_token';
const COOKIE_ROLE_KEY = 'skillsense_role';

/** Decode the role from a JWT payload without verifying the signature (client-side only). */
const decodeRole = (token: string): string => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role ?? '';
  } catch {
    return '';
  }
};

const setCookie = (name: string, value: string, days = 7): void => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
};

const deleteCookie = (name: string): void => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
};

export const getAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const setTokens = (accessToken: string, refreshToken?: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
  // Mirror to cookies for Next.js edge middleware
  setCookie(COOKIE_TOKEN_KEY, accessToken);
  setCookie(COOKIE_ROLE_KEY, decodeRole(accessToken));
};

export const removeTokens = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  // Clear cookies too
  deleteCookie(COOKIE_TOKEN_KEY);
  deleteCookie(COOKIE_ROLE_KEY);
};

export const isAuthenticated = (): boolean => {
  return !!getAccessToken();
};
