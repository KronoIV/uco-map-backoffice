import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsService, type AppSettingRequest, type AppSettingCreateRequest } from '../services/settingsService';
import type { AppSetting } from '../types';

const QUERY_KEY = ['settings'] as const;

// ── Queries ───────────────────────────────────────────────────────────────────

/** Carga todos los parámetros de configuración activos. */
export function useSettings() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: settingsService.getAll,
    staleTime: 30_000,
    retry: false,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Actualiza el valor (y opcionalmente metadatos) de un parámetro existente. */
export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: AppSettingRequest }) =>
      settingsService.update(key, data),
    onSuccess: (updated: AppSetting) => {
      // Actualización optimista: reemplazar el item en caché sin refetch completo
      qc.setQueryData<AppSetting[]>(QUERY_KEY, prev =>
        prev ? prev.map(s => (s.key === updated.key ? updated : s)) : [updated]
      );
    },
  });
}

/** Crea un nuevo parámetro de configuración. */
export function useCreateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AppSettingCreateRequest) => settingsService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

/** Elimina permanentemente un parámetro. */
export function useDeleteSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => settingsService.remove(key),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
