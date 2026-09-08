import api from './api';
import type { AuthLoginResponse } from '../types';

const TOKEN_COOKIE = 'ucomap_token';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 h

interface JwtPayload {
  sub: string;
  role: string;
  iat: number;
  exp: number;
}

export function saveToken(token: string): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; SameSite=Strict${secure}; Max-Age=${COOKIE_MAX_AGE}; Path=/`;
}

export function getStoredToken(): string | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${TOKEN_COOKIE}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearStoredToken(): void {
  document.cookie = `${TOKEN_COOKIE}=; SameSite=Strict; Max-Age=0; Path=/`;
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(payload: JwtPayload): boolean {
  return Date.now() >= payload.exp * 1000;
}

export const authService = {
  login: (email: string, password: string) =>
    api.post<AuthLoginResponse>('/api/auth/login', { email, password }).then(r => r.data),

  forgotPassword: (email: string) =>
    api.post('/api/auth/forgot-password', { email }).then(() => undefined),

  resetPassword: (token: string, newPassword: string) =>
    api.post('/api/auth/reset-password', { token, newPassword }).then(() => undefined),
};
