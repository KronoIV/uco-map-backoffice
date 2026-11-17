import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { multisetService } from '../services/multisetService';
import type { MultiSetUsage, MultiSetUsageRequest } from '../types';

const QUERY_KEY = ['multiset-usage'] as const;

/** Cupo estimado de MultiSet (el backend lo calcula con sus propios datos, sin llamar a MultiSet). */
export function useMultiSetUsage() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: multisetService.getUsage,
    refetchInterval: 120_000,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useUpdateMultiSetUsage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MultiSetUsageRequest) => multisetService.updateUsage(data),
    onSuccess: (usage: MultiSetUsage) => {
      qc.setQueryData(QUERY_KEY, usage);
      // Guardar puede apagar o encender la guía con cámara
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}
