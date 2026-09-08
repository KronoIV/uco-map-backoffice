import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

function readTokenCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)ucomap_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

api.interceptors.request.use(config => {
  const token = readTokenCookie();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function resolveApiError(error: unknown): string {
  const axiosError = error as { apiErrorCode?: string };
  return axiosError?.apiErrorCode ?? 'Ocurrió un error. Intenta de nuevo.';
}

// ── 401 handler ───────────────────────────────────────────────
let _on401: (() => void) | null = null;

export function registerOn401Handler(handler: () => void): void {
  _on401 = handler;
}

api.interceptors.response.use(
  response => {
    // Auto-unwrap {data, succeeded: true} so services receive the entity directly
    if (response.data !== null && typeof response.data === 'object' && response.data.succeeded === true) {
      response.data = response.data.data;
    }
    return response;
  },
  error => {
    const code = error.response?.data?.error;
    if (code) {
      error.apiErrorCode = code;
      error.apiErrorDetails = error.response?.data?.details;
    }
    if (error.response?.status === 401 && _on401) {
      _on401();
    }
    return Promise.reject(error);
  }
);

export default api;
