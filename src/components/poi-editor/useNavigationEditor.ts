import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { navigationService } from '../../services/navigationService';
import { resolveApiError } from '../../services/api';
import { readNavMesh, type BuildResult, type ConnectionCheck, type NavMeshPreview, type PatchCheck } from '../../utils/navmesh';
import type { BuildReport } from '../../utils/navmesh-builder';
import { patchArea, rampInfo, stairsRamp } from '../../utils/navPatches';
import { addElevatorStop, elevatorProblem, type DraftStop } from '../../utils/elevators';
import type { ArPoint, NavConnection, NavElevator, NavPatch } from '../../types';
import type { MapViewerApi, ViewerConnection, ViewerElevator, ViewerPatch } from './MapViewer';

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

export interface DraftElevator {
  id?: string;
  label: string;
  building: string;
  stops: DraftStop[];
}

const centroid = (pts: ArPoint[]): ArPoint => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  z: pts.reduce((s, p) => s + p.z, 0) / pts.length,
});

interface Generated {
  data: Uint8Array;
  preview: NavMeshPreview;
  removed: number;
  report: BuildReport;
}

export function useNavigationEditor(
  getViewer: () => MapViewerApi | null,
  expectedMaps: string[],
  onFocus: (p: ArPoint) => void,
) {
  const qc = useQueryClient();
  const connectionsQ = useQuery({ queryKey: ['nav-connections'], queryFn: navigationService.getConnections });
  const patchesQ = useQuery({ queryKey: ['nav-patches'], queryFn: navigationService.getPatches });
  const elevatorsQ = useQuery({ queryKey: ['nav-elevators'], queryFn: navigationService.getElevators });
  const infoQ = useQuery({ queryKey: ['navmesh-info'], queryFn: navigationService.getNavMeshInfo });
  const currentQ = useQuery({
    queryKey: ['navmesh-current', infoQ.data?.updatedAt ?? 'none'],
    enabled: infoQ.isSuccess,
    staleTime: Infinity,
    queryFn: async () => {
      const published = await navigationService.getNavMesh();
      return published ? { preview: await readNavMesh(published) } : null;
    },
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftConnection | null>(null);
  const [pickTarget, setPickTarget] = useState<PickTarget>(null);
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showNavMesh, setShowNavMesh] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatchId, setSelectedPatchId] = useState<string | null>(null);
  const [patchDraft, setPatchDraft] = useState<DraftPatch | null>(null);
  const [drawingPatch, setDrawingPatch] = useState(false);
  // Escalera guiada: dos esquinas al pie y dos arriba; con la cuarta se arma la rampa
  const [stairsMode, setStairsMode] = useState(false);
  // Resultado de la última generación por id de parche; un parche editado después ya no lo tiene
  const [patchChecks, setPatchChecks] = useState<Record<string, PatchCheck>>({});
  const [connectionChecks, setConnectionChecks] = useState<Record<string, ConnectionCheck>>({});
  // Ascensor en edición: cada clic en el modelo marca (o mueve) la parada de un piso frente a su puerta
  const [elevatorDraft, setElevatorDraft] = useState<DraftElevator | null>(null);
  const [selectedElevatorId, setSelectedElevatorId] = useState<string | null>(null);
  const [pickingStops, setPickingStops] = useState(false);

  const connections = useMemo(() => connectionsQ.data ?? [], [connectionsQ.data]);
  const patches = useMemo(() => patchesQ.data ?? [], [patchesQ.data]);
  const elevators = useMemo(() => elevatorsQ.data ?? [], [elevatorsQ.data]);

  const invalidateConnections = () => {
    qc.invalidateQueries({ queryKey: ['nav-connections'] });
    setDirty(true);
  };

  const saveMut = useMutation({
    mutationFn: (c: NavConnection) => (c.id ? navigationService.updateConnection(c.id, c) : navigationService.createConnection(c)),
    onSuccess: saved => {
      setConnectionChecks(prev => {
        const next = { ...prev };
        delete next[saved.id!];
        return next;
      });
      invalidateConnections();
      cancel();
    },
    onError: err => setError(resolveApiError(err)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => navigationService.deleteConnection(id),
    onSuccess: () => { invalidateConnections(); cancel(); },
    onError: err => setError(resolveApiError(err)),
  });

  const publishMut = useMutation({
    mutationFn: (data: Uint8Array) => navigationService.saveNavMesh(data),
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
    onSuccess: saved => {
      setPatchChecks(prev => {
        const next = { ...prev };
        delete next[saved.id!];
        return next;
      });
      invalidatePatches();
    },
    onError: err => setError(resolveApiError(err)),
  });

  const deletePatchMut = useMutation({
    mutationFn: (id: string) => navigationService.deletePatch(id),
    onSuccess: invalidatePatches,
    onError: err => setError(resolveApiError(err)),
  });

  // Los ascensores no entran al navmesh: guardarlos no pide regenerarlo, la app los usa de inmediato
  const saveElevatorMut = useMutation({
    mutationFn: (e: NavElevator) => (e.id ? navigationService.updateElevator(e.id, e) : navigationService.createElevator(e)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nav-elevators'] }); cancelElevator(); },
    onError: err => setError(resolveApiError(err)),
  });

  const deleteElevatorMut = useMutation({
    mutationFn: (id: string) => navigationService.deleteElevator(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nav-elevators'] }); cancelElevator(); },
    onError: err => setError(resolveApiError(err)),
  });

  function cancelElevator() {
    setElevatorDraft(null);
    setSelectedElevatorId(null);
    setPickingStops(false);
  }

  function startElevator() {
    cancel();
    cancelPatch();
    setSelectedElevatorId(null);
    setElevatorDraft({ label: `Ascensor ${elevators.length + 1}`, building: '', stops: [] });
    setPickingStops(true);
  }

  function selectElevator(id: string) {
    const e = elevators.find(x => x.id === id);
    if (!e) return;
    cancel();
    cancelPatch();
    setSelectedElevatorId(id);
    setElevatorDraft({
      id: e.id,
      label: e.label,
      building: e.building ?? '',
      stops: e.stops.map(s => ({ floor: s.floor, button: s.button ?? '', point: s.point })).sort((a, b) => a.point.y - b.point.y),
    });
    setPickingStops(false);
    onFocus(centroid(e.stops.map(s => s.point)));
  }

  function updateStop(index: number, change: Partial<DraftStop>) {
    setElevatorDraft(d => (d ? { ...d, stops: d.stops.map((s, i) => (i === index ? { ...s, ...change } : s)) } : d));
  }

  function removeStop(index: number) {
    setElevatorDraft(d => (d ? { ...d, stops: d.stops.filter((_, i) => i !== index) } : d));
  }

  function saveElevator() {
    if (!elevatorDraft || elevatorProblem(elevatorDraft.stops)) return;
    saveElevatorMut.mutate({
      ...(elevatorDraft.id ? { id: elevatorDraft.id } : {}),
      label: elevatorDraft.label.trim() || 'Ascensor',
      building: elevatorDraft.building.trim() || null,
      stops: elevatorDraft.stops.map(s => ({ floor: s.floor, button: s.button.trim() || null, point: s.point })),
    });
  }

  // Marcando paradas: Escape o Enter terminan
  useEffect(() => {
    if (!pickingStops) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape' || e.key === 'Enter') setPickingStops(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickingStops]);

  function cancelPatch() {
    setPatchDraft(null);
    setSelectedPatchId(null);
    setDrawingPatch(false);
    setStairsMode(false);
  }

  function startPatch() {
    cancel();
    cancelElevator();
    setSelectedPatchId(null);
    setPatchDraft({ label: `Parche ${patches.length + 1}`, points: [] });
    setDrawingPatch(true);
    setStairsMode(false);
  }

  function startStairs() {
    cancel();
    cancelElevator();
    setSelectedPatchId(null);
    setPatchDraft({ label: `Escalera ${patches.filter(p => rampInfo(p.points)).length + 1}`, points: [] });
    setDrawingPatch(true);
    setStairsMode(true);
  }

  function selectPatch(id: string) {
    const p = patches.find(x => x.id === id);
    if (!p) return;
    cancel();
    cancelElevator();
    setSelectedPatchId(id);
    setPatchDraft({ id: p.id, label: p.label, points: p.points });
    setDrawingPatch(false);
    setStairsMode(false);
    onFocus(centroid(p.points));
  }

  const undoPatchPoint = () => setPatchDraft(d => (d ? { ...d, points: d.points.slice(0, -1) } : d));

  function redrawPatch() {
    if (!patchDraft) return;
    setStairsMode(!!rampInfo(patchDraft.points) || stairsMode);
    setPatchDraft({ ...patchDraft, points: [] });
    setDrawingPatch(true);
  }

  function finishDrawing() {
    setDrawingPatch(false);
    setStairsMode(false);
  }

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
        setStairsMode(false);
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
    cancelElevator();
    setSelectedId(null);
    setDraft({ label: `Escalera ${connections.length + 1}`, group: '', start: null, end: null, radius: 1, bidirectional: true });
    setPickTarget('start');
  }

  function select(id: string) {
    const c = connections.find(x => x.id === id);
    if (!c) return;
    cancelPatch();
    cancelElevator();
    setSelectedId(id);
    setDraft({ ...c, group: c.group ?? '' });
    setPickTarget(null);
    onFocus({ x: (c.start.x + c.end.x) / 2, y: (c.start.y + c.end.y) / 2, z: (c.start.z + c.end.z) / 2 });
  }

  /** Devuelve true si el clic se us\u00f3 para la conexi\u00f3n en edici\u00f3n. */
  function handlePick(p: ArPoint): boolean {
    if (elevatorDraft && pickingStops) {
      // La parada va sobre el piso: un clic sobre basura del escaneo baja al piso que haya debajo
      const floorY = getViewer()?.floorAt(p.x, p.z, p.y) ?? null;
      const point = floorY === null ? p : { ...p, y: Math.round(floorY * 1000) / 1000 };
      setElevatorDraft({ ...elevatorDraft, stops: addElevatorStop(elevatorDraft.stops, point) });
      return true;
    }
    if (patchDraft && drawingPatch) {
      const points = [...patchDraft.points, p];
      if (stairsMode && points.length === 4) {
        const viewer = getViewer();
        const ramp = stairsRamp(points as [ArPoint, ArPoint, ArPoint, ArPoint], viewer ? viewer.floorAt : undefined);
        setPatchDraft({ ...patchDraft, points: ramp });
        setDrawingPatch(false);
        setStairsMode(false);
      } else {
        setPatchDraft({ ...patchDraft, points });
      }
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
    const usedPatches = patches;
    const usedConnections = connections;
    const worker = new Worker(new URL('../../workers/navmeshWorker.ts', import.meta.url), { type: 'module' });
    try {
      const result = await new Promise<({ ok: true } & BuildResult) | { ok: false; error: string }>(
        (resolve, reject) => {
          worker.onmessage = e => resolve(e.data);
          worker.onerror = e => reject(new Error(e.message));
          worker.postMessage({
            positions: geometry.positions,
            indices: geometry.indices,
            connections: usedConnections.map(c => ({
              startPosition: c.start, endPosition: c.end, radius: c.radius, bidirectional: c.bidirectional,
            })),
            patches: usedPatches.map(p => ({ points: p.points })),
          }, [geometry.positions.buffer, geometry.indices.buffer]);
        },
      );
      if (!result.ok) throw new Error(result.error);
      setGenerated({ data: result.data, preview: result.preview, removed: result.removed, report: result.report });
      setPatchChecks(Object.fromEntries(usedPatches.map((p, i) => [p.id!, result.patchChecks[i]])));
      setConnectionChecks(Object.fromEntries(usedConnections.map((c, i) => [c.id!, result.connectionChecks[i]])));
      setDirty(false);
      setShowNavMesh(true);
    } catch (err) {
      setError(`No se pudo generar el navmesh: ${err instanceof Error ? err.message : err}`);
    } finally {
      worker.terminate();
      setGenerating(false);
    }
  }

  /** Descarga la geometría que entraría a recast (sin generar ni publicar) para el experimento offline de la app. */
  async function exportInput() {
    const viewer = getViewer();
    if (!viewer) return;
    setError(null);
    const geometry = viewer.collectGeometry();
    const missing = expectedMaps.filter(n => !geometry.meshNames.includes(n));
    if (missing.length) {
      setError(`Activa y espera a que carguen todos los mapas antes de exportar (faltan: ${missing.join(', ')}).`);
      return;
    }
    setExporting(true);
    const worker = new Worker(new URL('../../workers/navmeshWorker.ts', import.meta.url), { type: 'module' });
    try {
      const result = await new Promise<{ ok: true; file: Uint8Array<ArrayBuffer> } | { ok: false; error: string }>(
        (resolve, reject) => {
          worker.onmessage = e => resolve(e.data);
          worker.onerror = e => reject(new Error(e.message));
          worker.postMessage({
            mode: 'input',
            positions: geometry.positions,
            indices: geometry.indices,
            connections: connections.map(c => ({
              startPosition: c.start, endPosition: c.end, radius: c.radius, bidirectional: c.bidirectional,
            })),
            patches: patches.map(p => ({ points: p.points })),
            meshNames: geometry.meshNames,
          }, [geometry.positions.buffer, geometry.indices.buffer]);
        },
      );
      if (!result.ok) throw new Error(result.error);
      const url = URL.createObjectURL(new Blob([result.file], { type: 'application/octet-stream' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `navmesh-input-${new Date().toISOString().slice(0, 10)}.bin`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`No se pudo exportar la geometría: ${err instanceof Error ? err.message : err}`);
    } finally {
      worker.terminate();
      setExporting(false);
    }
  }

  const viewerConnections = useMemo<ViewerConnection[]>(() => {
    const list: ViewerConnection[] = connections
      .filter(c => c.id !== selectedId)
      .map(c => ({ id: c.id!, label: c.label, start: c.start, end: c.end, selected: false, selectable: !drawingPatch && !pickTarget && !pickingStops }));
    if (draft?.start) {
      list.push({ id: draft.id ?? 'draft', label: draft.label, start: draft.start, end: draft.end, selected: true, selectable: false });
    }
    return list;
  }, [connections, selectedId, draft, drawingPatch, pickTarget, pickingStops]);

  const viewerPatches = useMemo<ViewerPatch[]>(() => {
    const list: ViewerPatch[] = patches
      .filter(p => p.id !== selectedPatchId)
      .map(p => {
        const check = patchChecks[p.id!];
        const ramp = rampInfo(p.points);
        // En una escalera, el pie y el final tienen que unirse; los costados suelen dar a paredes
        const edges = check?.linkedSides?.length === p.points.length
          ? check.linkedSides.map((linked, i) => (linked ? 'linked' : ramp && (i === ramp.bottom || i === ramp.top) ? 'missing' : null))
          : undefined;
        return { id: p.id!, label: p.label, points: p.points, selected: false, selectable: !drawingPatch && !pickTarget && !pickingStops, edges };
      });
    if (patchDraft?.points.length) {
      list.push({ id: patchDraft.id ?? 'draft', label: patchDraft.label, points: patchDraft.points, selected: true, selectable: false });
    }
    return list;
  }, [patches, selectedPatchId, patchDraft, drawingPatch, pickTarget, pickingStops, patchChecks]);

  const viewerElevators = useMemo<ViewerElevator[]>(() => {
    const list: ViewerElevator[] = elevators
      .filter(e => e.id !== selectedElevatorId)
      .map(e => ({ id: e.id!, label: e.label, stops: e.stops, selected: false, selectable: !drawingPatch && !pickTarget && !pickingStops }));
    if (elevatorDraft?.stops.length) {
      list.push({ id: elevatorDraft.id ?? 'draft', label: elevatorDraft.label, stops: elevatorDraft.stops, selected: true, selectable: false });
    }
    return list;
  }, [elevators, selectedElevatorId, elevatorDraft, drawingPatch, pickTarget, pickingStops]);

  // Cada punto toma la altura del modelo (rampas, escaleras); sobre el hueco, la del punto anterior. En la escalera
  // guiada el tercer clic va al piso de arriba: no hereda la altura del pie
  const draftPoints = patchDraft?.points ?? [];
  const pickPlaneY = drawingPatch && draftPoints.length && !(stairsMode && draftPoints.length === 2)
    ? draftPoints[draftPoints.length - 1].y
    : null;

  const shownPreview = generated?.preview ?? currentQ.data?.preview ?? null;

  return {
    connections,
    connectionsLoading: connectionsQ.isLoading,
    info: infoQ.data ?? null,
    currentLoaded: currentQ.isSuccess,
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
    generate,
    exportInput,
    exporting,
    publish: () => generated && publishMut.mutate(generated.data),
    publishing: publishMut.isPending,
    discardGenerated: () => setGenerated(null),
    handlePick,
    viewerConnections,
    patches,
    patchesLoading: patchesQ.isLoading,
    patchDraft,
    setPatchDraft,
    patchDraftArea: patchDraft ? patchArea(patchDraft.points) : 0,
    patchDraftRamp: patchDraft && !stairsMode ? rampInfo(patchDraft.points) : null,
    selectedPatchId,
    drawingPatch,
    setDrawingPatch,
    stairsMode,
    startPatch,
    startStairs,
    redrawPatch,
    finishDrawing,
    selectPatch,
    cancelPatch,
    undoPatchPoint,
    savePatch,
    savingPatch: savePatchMut.isPending,
    removePatch: (id: string) => deletePatchMut.mutate(id),
    patchChecks,
    connectionChecks,
    focus: onFocus,
    viewerPatches,
    pickPlaneY,
    viewerNavMesh: showNavMesh ? shownPreview : null,
    elevators,
    elevatorsLoading: elevatorsQ.isLoading,
    elevatorDraft,
    setElevatorDraft,
    elevatorProblem: elevatorDraft ? elevatorProblem(elevatorDraft.stops) : null,
    selectedElevatorId,
    pickingStops,
    setPickingStops,
    startElevator,
    selectElevator,
    cancelElevator,
    updateStop,
    removeStop,
    saveElevator,
    savingElevator: saveElevatorMut.isPending,
    removeElevator: (id: string) => deleteElevatorMut.mutate(id),
    viewerElevators,
  };
}

export type NavigationEditor = ReturnType<typeof useNavigationEditor>;
