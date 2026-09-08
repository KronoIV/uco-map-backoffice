import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { deviceSessionService } from '../services/deviceSessionService';
import { getStoredToken } from '../services/authService';
import type { DeviceSession, SessionStats } from '../types';

const SSE_URL = `${import.meta.env.VITE_BACKEND_URL}/api/sessions/stream`;

export function useDeviceSessions() {
  return useQuery({
    queryKey: ['device-sessions'],
    queryFn: deviceSessionService.getAll,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useSessionStats() {
  return useQuery({
    queryKey: ['session-stats'],
    queryFn: deviceSessionService.getStats,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

// fetch-based SSE that supports Authorization header (native EventSource does not)
function connectFetchSSE(
  url: string,
  onEvent: (eventName: string, data: string) => void,
  onError: () => void,
  signal: AbortSignal,
): void {
  const token = getStoredToken();
  const headers: Record<string, string> = { Accept: 'text/event-stream' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  fetch(url, { headers, signal })
    .then(async res => {
      if (!res.ok || !res.body) { onError(); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let eventName = 'message';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            onEvent(eventName, line.slice(5).trim());
            eventName = 'message';
          } else if (line === '') {
            eventName = 'message';
          }
        }
      }
    })
    .catch(() => {
      if (!signal.aborted) onError();
    });
}

/**
 * Opens a long-lived SSE connection to /api/sessions/stream.
 * On each "session" event: upserts the session in the React Query cache.
 * On each "stats" event: replaces the stats cache entry.
 * Reconnects automatically if the connection drops.
 */
export function useSessionStream() {
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      const controller = new AbortController();
      abortRef.current = controller;

      connectFetchSSE(
        SSE_URL,
        (eventName, data) => {
          if (eventName === 'session') {
            const updated: DeviceSession = JSON.parse(data);
            queryClient.setQueryData<DeviceSession[]>(['device-sessions'], prev => {
              if (!prev) return [updated];
              const idx = prev.findIndex(s => s.id === updated.id);
              if (idx === -1) return [updated, ...prev];
              const next = [...prev];
              next[idx] = updated;
              return next;
            });
          } else if (eventName === 'stats') {
            const stats: SessionStats = JSON.parse(data);
            queryClient.setQueryData(['session-stats'], stats);
          }
        },
        () => {
          retryTimeout = setTimeout(connect, 5_000);
        },
        controller.signal,
      );
    }

    connect();

    return () => {
      clearTimeout(retryTimeout);
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [queryClient]);
}

