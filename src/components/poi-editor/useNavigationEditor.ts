import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { navigationService } from '../../services/navigationService';
import { resolveApiError } from '../../services/api';
import { readNavMesh, type NavMeshPreview } from '../../utils/navmesh';
import { appendPatches, patchArea } from '../../utils/navPatches';
import sceneConnectionsData from '../../data/sceneConnections.json';
import type { ArPoint, NavConnection, NavPatch } from '../../types';
import type { MapViewerApi, ViewerConnection, ViewerPatch } from './MapViewer';

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

export interface DraftPatch {
  id?: string;
  label: string;
  points: ArPoint[];
}

const centroid = (pts: ArPoint[]): ArPoint => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  z: pts.reduce((s, p) => s + p.z, 0) / pts.length,
});

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
  const patchesQ = useQuery({ queryKey: ['nav-patches'], queryFn: navigationService.getPatches });
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
  const [selectedPatchId, setSelectedPatchId] = useState<string | null>(null);
  const [patchDraft, setPatchDraft] = useState<DraftPatch | null>(null);
  const [drawingPatch, setDrawingPatch] = useState(false);

  const connections = useMemo(() => connectionsQ.data ?? [], [connectionsQ.data]);
  const patches = useMemo(() => patchesQ.data ?? [], [patchesQ.data]);

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

  const invalidatePatches = () => {
    qc.invalidateQueries({ queryKey: ['nav-patches'] });
    setDirty(true);
    cancelPatch();
  };

  const savePatchMut = useMutation({
    mutationFn: (p: NavPatch) => (p.id ? navigationService.updatePatch(p.id, p) : navigationService.createPatch(p)),
    onSuccess: invalidatePatches,
    onError: err => setError(resolveApiError(err)),
  });

  const deletePatchMut = useMutation({
    mutationFn: (id: string) => navigationService.deletePatch(id),
    onSuccess: invalidatePatches,
    onError: err => setError(resolveApiError(err)),
  });

  function cancelPatch() {
    setPatchDraft(null);
    setSelectedPatchId(null);
    setDrawingPatch(false);
  }

  function startPatch() {
    cancel();
    setSelectedPatchId(null);
    setPatchDraft({ label: `Parche ${patches.length + 1}`, points: [] });
    setDrawingPatch(true);
  }

  function selectPatch(id: string) {
    const p = patches.find(x => x.id === id);
    if (!p) return;
    cancel();
    setSelectedPatchId(id);
    setPatchDraft({ id: p.id, label: p.label, points: p.points });
    setDrawingPatch(false);
    onFocus(centroid(p.points));
  }

  const undoPatchPoint = () => setPatchDraft(d => (d ? { ...d, points: d.points.slice(0, -1) } : d));

  function savePatch() {
    if (!patchDraft || patchDraft.points.length < 3) return;
    savePatchMut.mutate({ ...patchDraft, label: patchDraft.label.trim() || 'Parche' });
  }

  // Atajos mientras se dibuja: deshacer el último punto y terminar
  useEffect(() => {
    if (!drawingPatch) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Backspace' || (e.key.toLowerCase() === 'z' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        undoPatchPoint();
      } else if (e.key === 'Escape' || e.key === 'Enter') {
        setDrawingPatch(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawingPatch]);

  function cancel() {
    setDraft(null);
    setSelectedId(null);
    setPickTarget(null);
  }

  function startNew() {
    cancelPatch();
    setSelectedId(null);
    setDraft({ label: `Escalera ${connections.length + 1}`, group: '', start: null, end: null, radius: 1, bidirectional: true });
    setPickTarget('start');
  }

  function select(id: string) {
    const c = connections.find(x => x.id === id);
    if (!c) return;
    cancelPatch();
    setSelectedId(id);
    setDraft({ ...c, group: c.group ?? '' });
    setPickTarget(null);
    onFocus({ x: (c.start.x + c.end.x) / 2, y: (c.start.y + c.end.y) / 2, z: (c.start.z + c.end.z) / 2 });
  }

  /** Devuelve true si el clic se us\u00f3 para la conexi\u00f3n en edici\u00f3n. */
  function handlePick(p: ArPoint): boolean {
    if (patchDraft && drawingPatch) {
      setPatchDraft({ ...patchDraft, points: [...patchDraft.points, p] });
      return true;
    }
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
    const input = appendPatches(geometry.positions, geometry.indices, patches);
    const worker = new Worker(new URL('../../workers/navmeshWorker.ts', import.meta.url), { type: 'module' });
    try {
      const result = await new Promise<{ ok: true; data: Uint8Array; preview: NavMeshPreview } | { ok: false; error: string }>(
        (resolve, reject) => {
          worker.onmessage = e => resolve(e.data);
          worker.onerror = e => reject(new Error(e.message));
          worker.postMessage({
            positions: input.positions,
            indices: input.indices,
            connections: connections.map(c => ({
              startPosition: c.start, endPosition: c.end, radius: c.radius, bidirectional: c.bidirectional,
            })),
          }, [input.positions.buffer, input.indices.buffer]);
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

  const viewerPatches = useMemo<ViewerPatch[]>(() => {
    const list: ViewerPatch[] = patches
      .filter(p => p.id !== selectedPatchId)
      .map(p => ({ id: p.id!, label: p.label, points: p.points, selected: false, selectable: !drawingPatch && !pickTarget }));
    if (patchDraft?.points.length) {
      list.push({ id: patchDraft.id ?? 'draft', label: patchDraft.label, points: patchDraft.points, selected: true, selectable: false });
    }
    return list;
  }, [patches, selectedPatchId, patchDraft, drawingPatch, pickTarget]);

  // Sin modelo bajo el cursor (el hueco), el punto queda a la altura del parche
  const pickPlaneY = drawingPatch && patchDraft?.points.length ? centroid(patchDraft.points).y : null;

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
    patches,
    patchesLoading: patchesQ.isLoading,
    patchDraft,
    setPatchDraft,
    patchDraftArea: patchDraft ? patchArea(patchDraft.points) : 0,
    selectedPatchId,
    drawingPatch,
    setDrawingPatch,
    startPatch,
    selectPatch,
    cancelPatch,
    undoPatchPoint,
    savePatch,
    savingPatch: savePatchMut.isPending,
    removePatch: (id: string) => deletePatchMut.mutate(id),
    viewerPatches,
    pickPlaneY,
    viewerNavMesh: showNavMesh ? shownPreview : null,
  };
}

export type NavigationEditor = ReturnType<typeof useNavigationEditor>;
