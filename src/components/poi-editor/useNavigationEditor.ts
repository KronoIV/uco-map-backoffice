import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { navigationService } from '../../services/navigationService';
import { resolveApiError } from '../../services/api';
import { readNavMesh, type NavMeshPreview } from '../../utils/navmesh';
import sceneConnectionsData from '../../data/sceneConnections.json';
import type { ArPoint, NavConnection } from '../../types';
import type { MapViewerApi, ViewerConnection } from './MapViewer';

interface SceneConnection {
  label: string;
  group: string;
  start: [number, number, number];
  end: [number, number, number];
  radius: number;
  bidirectional: boolean;
}

// Escaleras que exist\u00edan en Scene.zcomp (Mattercraft), extra\u00eddas una sola vez
const sceneConnections = sceneConnectionsData as SceneConnection[];
const toPoint = (p: [number, number, number]): ArPoint => ({ x: p[0], y: p[1], z: p[2] });

export interface DraftConnection {
  id?: string;
  label: string;
  group: string;
  start: ArPoint | null;
  end: ArPoint | null;
  radius: number;
  bidirectional: boolean;
}

export type PickTarget = 'start' | 'end' | null;

interface Generated {
  data: Uint8Array;
  preview: NavMeshPreview;
}

export function useNavigationEditor(
  getViewer: () => MapViewerApi | null,
  expectedMaps: string[],
  onFocus: (p: ArPoint) => void,
) {
  const qc = useQueryClient();
  const connectionsQ = useQuery({ queryKey: ['nav-connections'], queryFn: navigationService.getConnections });
  const infoQ = useQuery({ queryKey: ['navmesh-info'], queryFn: navigationService.getNavMeshInfo });
  const currentQ = useQuery({
    queryKey: ['navmesh-current', infoQ.data?.updatedAt ?? 'scene'],
    enabled: infoQ.isSuccess,
    staleTime: Infinity,
    queryFn: async () => {
      const published = await navigationService.getNavMesh();
      if (published) return { source: 'backend' as const, preview: await readNavMesh(published) };
      const res = await fetch('/scene.navmesh');
      return { source: 'scene' as const, preview: await readNavMesh(new Uint8Array(await res.arrayBuffer())) };
    },
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftConnection | null>(null);
  const [pickTarget, setPickTarget] = useState<PickTarget>(null);
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [generating, setGenerating] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showNavMesh, setShowNavMesh] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const connections = useMemo(() => connectionsQ.data ?? [], [connectionsQ.data]);

  const invalidateConnections = () => {
    qc.invalidateQueries({ queryKey: ['nav-connections'] });
    setDirty(true);
  };

  const saveMut = useMutation({
    mutationFn: (c: NavConnection) => (c.id ? navigationService.updateConnection(c.id, c) : navigationService.createConnection(c)),
    onSuccess: () => { invalidateConnections(); cancel(); },
    onError: err => setError(resolveApiError(err)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => navigationService.deleteConnection(id),
    onSuccess: () => { invalidateConnections(); cancel(); },
    onError: err => setError(resolveApiError(err)),
  });

  const importMut = useMutation({
    mutationFn: () => navigationService.createConnections(sceneConnections.map(c => ({
      label: c.label, group: c.group, start: toPoint(c.start), end: toPoint(c.end),
      radius: c.radius, bidirectional: c.bidirectional,
    }))),
    onSuccess: invalidateConnections,
    onError: err => setError(resolveApiError(err)),
  });

  const publishMut = useMutation({
    mutationFn: (data: Uint8Array) => navigationService.saveNavMesh(data),
    onSuccess: () => { setGenerated(null); qc.invalidateQueries({ queryKey: ['navmesh-info'] }); },
    onError: err => setError(resolveApiError(err)),
  });

  const restoreMut = useMutation({
    mutationFn: () => navigationService.deleteNavMesh(),
    onSuccess: () => { setGenerated(null); qc.invalidateQueries({ queryKey: ['navmesh-info'] }); },
    onError: err => setError(resolveApiError(err)),
  });

  function cancel() {
    setDraft(null);
    setSelectedId(null);
    setPickTarget(null);
  }

  function startNew() {
    setSelectedId(null);
    setDraft({ label: `Escalera ${connections.length + 1}`, group: '', start: null, end: null, radius: 1, bidirectional: true });
    setPickTarget('start');
  }

  function select(id: string) {
    const c = connections.find(x => x.id === id);
    if (!c) return;
    setSelectedId(id);
    setDraft({ ...c, group: c.group ?? '' });
    setPickTarget(null);
    onFocus({ x: (c.start.x + c.end.x) / 2, y: (c.start.y + c.end.y) / 2, z: (c.start.z + c.end.z) / 2 });
  }

  /** Devuelve true si el clic se us\u00f3 para la conexi\u00f3n en edici\u00f3n. */
  function handlePick(p: ArPoint): boolean {
    if (!draft || !pickTarget) return false;
    if (pickTarget === 'start') {
      setDraft({ ...draft, start: p });
      setPickTarget(draft.end ? null : 'end');
    } else {
      setDraft({ ...draft, end: p });
      setPickTarget(null);
    }
    return true;
  }

  function save() {
    if (!draft?.start || !draft.end) return;
    saveMut.mutate({ ...draft, start: draft.start, end: draft.end });
  }

  async function generate() {
    const viewer = getViewer();
    if (!viewer) return;
    setError(null);
    const geometry = viewer.collectGeometry();
    const missing = expectedMaps.filter(n => !geometry.meshNames.includes(n));
    if (missing.length) {
      setError(`Activa y espera a que carguen todos los mapas antes de generar (faltan: ${missing.join(', ')}).`);
      return;
    }
    setGenerating(true);
    const worker = new Worker(new URL('../../workers/navmeshWorker.ts', import.meta.url), { type: 'module' });
    try {
      const result = await new Promise<{ ok: true; data: Uint8Array; preview: NavMeshPreview } | { ok: false; error: string }>(
        (resolve, reject) => {
          worker.onmessage = e => resolve(e.data);
          worker.onerror = e => reject(new Error(e.message));
          worker.postMessage({
            positions: geometry.positions,
            indices: geometry.indices,
            connections: connections.map(c => ({
              startPosition: c.start, endPosition: c.end, radius: c.radius, bidirectional: c.bidirectional,
            })),
          }, [geometry.positions.buffer, geometry.indices.buffer]);
        },
      );
      if (!result.ok) throw new Error(result.error);
      setGenerated({ data: result.data, preview: result.preview });
      setDirty(false);
      setShowNavMesh(true);
    } catch (err) {
      setError(`No se pudo generar el navmesh: ${err instanceof Error ? err.message : err}`);
    } finally {
      worker.terminate();
      setGenerating(false);
    }
  }

  const viewerConnections = useMemo<ViewerConnection[]>(() => {
    const list: ViewerConnection[] = connections
      .filter(c => c.id !== selectedId)
      .map(c => ({ id: c.id!, label: c.label, start: c.start, end: c.end, selected: false }));
    if (draft?.start) {
      list.push({ id: draft.id ?? 'draft', label: draft.label, start: draft.start, end: draft.end, selected: true });
    }
    return list;
  }, [connections, selectedId, draft]);

  const shownPreview = generated?.preview ?? currentQ.data?.preview ?? null;

  return {
    connections,
    connectionsLoading: connectionsQ.isLoading,
    sceneConnectionCount: sceneConnections.length,
    info: infoQ.data ?? null,
    currentSource: currentQ.data?.source ?? null,
    currentPreview: currentQ.data?.preview ?? null,
    generated,
    generating,
    dirty,
    showNavMesh,
    setShowNavMesh,
    error,
    setError,
    selectedId,
    draft,
    setDraft,
    pickTarget,
    setPickTarget,
    startNew,
    select,
    cancel,
    save,
    saving: saveMut.isPending,
    remove: (id: string) => deleteMut.mutate(id),
    importFromScene: () => importMut.mutate(),
    importing: importMut.isPending,
    generate,
    publish: () => generated && publishMut.mutate(generated.data),
    publishing: publishMut.isPending,
    discardGenerated: () => setGenerated(null),
    restoreScene: () => restoreMut.mutate(),
    handlePick,
    viewerConnections,
    viewerNavMesh: showNavMesh ? shownPreview : null,
  };
}

export type NavigationEditor = ReturnType<typeof useNavigationEditor>;
