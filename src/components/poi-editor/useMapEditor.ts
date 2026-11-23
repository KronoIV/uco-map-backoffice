import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { mapEditService } from '../../services/mapEditService';
import { resolveApiError } from '../../services/api';
import { blockCenter, blockedAreas, blockedConnectionIds } from '../../utils/mapEdits';
import type { ArPoint, NavBlock, NavConnection, ScanEdit } from '../../types';
import type { MapViewerApi, ViewerBlock } from './MapViewer';
import { EMPTY_SELECTION, type EditMode, type EditTool, type SelectionSummary, type ViewerScanEdit } from './sceneEditing';

export type LocalScanEdit = ScanEdit & { localId: string };
export type LocalBlock = NavBlock & { localId: string };

interface EditState {
  scanEdits: LocalScanEdit[];
  blocks: LocalBlock[];
}

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

export const MODEL_TOOLS: EditTool[] = ['fragment', 'brush', 'box'];
export const NAV_TOOLS: EditTool[] = ['poly', 'box', 'barrier'];

// A partir de aquí se pide confirmar: borrar mucho de un clic suele ser un error de selección
const CONFIRM_TRIANGLES = 20_000;
const CONFIRM_MODEL_M2 = 25;
const CONFIRM_POLYS = 30;
const CONFIRM_NAV_M2 = 40;

let seq = 0;
const tempId = () => `local-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const m2 = (v: number) => `${v.toLocaleString('es', { maximumFractionDigits: 1 })} m²`;
const n = (v: number) => v.toLocaleString('es');

function scanEditBody(e: LocalScanEdit): ScanEdit {
  return { label: e.label, meshes: e.meshes, center: e.center, triangleCount: e.triangleCount };
}

function blockBody(b: LocalBlock): NavBlock {
  return { label: b.label, kind: b.kind, polygons: b.polygons ?? null, line: b.line ?? null, connectionId: b.connectionId ?? null };
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable);

/**
 * Edición del modelo 3D (quitar geometría del escaneo) y de la malla de navegación (bloquear zonas, cortes y
 * conexiones). Los cambios se acumulan en un borrador con deshacer/rehacer y se guardan juntos.
 */
export function useMapEditor(
  getViewer: () => MapViewerApi | null,
  active: boolean,
  connections: NavConnection[],
) {
  const qc = useQueryClient();
  const scanQ = useQuery({ queryKey: ['scan-edits'], queryFn: mapEditService.getScanEdits });
  const blocksQ = useQuery({ queryKey: ['nav-blocks'], queryFn: mapEditService.getBlocks });

  const saved = useMemo<EditState>(() => ({
    scanEdits: (scanQ.data ?? []).map(e => ({ ...e, localId: e.id! })),
    blocks: (blocksQ.data ?? []).map(b => ({ ...b, localId: b.id! })),
  }), [scanQ.data, blocksQ.data]);

  const [working, setWorking] = useState<EditState | null>(null);
  const [undoStack, setUndoStack] = useState<EditState[]>([]);
  const [redoStack, setRedoStack] = useState<EditState[]>([]);
  // Sube con cada cambio del admin (no con las recargas): el navmesh queda desactualizado
  const [revision, setRevision] = useState(0);
  const state = working ?? saved;

  const [mode, setModeState] = useState<Exclude<EditMode, 'none'>>('model');
  const [modelTool, setModelTool] = useState<EditTool>('fragment');
  const [navTool, setNavTool] = useState<EditTool>('poly');
  const [brushSize, setBrushSize] = useState(0.4);
  const [reach, setReach] = useState(3);
  const [visibleOnly, setVisibleOnly] = useState(true);
  const [showRemoved, setShowRemoved] = useState(false);
  const [selection, setSelection] = useState<SelectionSummary>(EMPTY_SELECTION);
  const [barrier, setBarrier] = useState<ArPoint[] | null>(null);
  const [mismatched, setMismatched] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tool = mode === 'model' ? modelTool : navTool;
  const setTool = (t: EditTool) => {
    if (mode === 'model') setModelTool(t); else setNavTool(t);
    if (t !== 'barrier') setBarrier(null);
  };
  const setMode = (m: Exclude<EditMode, 'none'>) => {
    setModeState(m);
    setBarrier(null);
  };

  const apply = (next: EditState) => {
    setUndoStack(u => [...u.slice(-99), state]);
    setRedoStack([]);
    setWorking(next);
    setRevision(r => r + 1);
  };

  const undo = () => {
    if (!undoStack.length) return;
    setRedoStack(r => [state, ...r]);
    setWorking(undoStack[undoStack.length - 1]);
    setUndoStack(u => u.slice(0, -1));
    setRevision(r => r + 1);
  };

  const redo = () => {
    if (!redoStack.length) return;
    setUndoStack(u => [...u, state]);
    setWorking(redoStack[0]);
    setRedoStack(r => r.slice(1));
    setRevision(r => r + 1);
  };

  const changes = useMemo(() => {
    const workIds = new Set([...state.scanEdits, ...state.blocks].map(x => x.id).filter(Boolean));
    return {
      newScanEdits: state.scanEdits.filter(e => !e.id),
      newBlocks: state.blocks.filter(b => !b.id),
      restoredScanEdits: saved.scanEdits.filter(e => !workIds.has(e.id)),
      removedBlocks: saved.blocks.filter(b => !workIds.has(b.id)),
    };
  }, [state, saved]);
  const changeCount = changes.newScanEdits.length + changes.newBlocks.length
    + changes.restoredScanEdits.length + changes.removedBlocks.length;
  const unsaved = changeCount > 0;

  // ── Acciones sobre la selección ──────────────────────────

  function deleteModelSelection() {
    const viewer = getViewer();
    const sel = selection.model;
    if (!viewer || !sel.triangles) return;
    const run = () => {
      const taken = viewer.takeModelSelection();
      if (!taken) return;
      const edit: LocalScanEdit = {
        localId: tempId(),
        label: `Limpieza ${state.scanEdits.length + 1} · ${m2(sel.areaM2)}`,
        ...taken,
      };
      apply({ ...state, scanEdits: [...state.scanEdits, edit] });
      viewer.clearSelection();
    };
    if (sel.triangles > CONFIRM_TRIANGLES || sel.areaM2 > CONFIRM_MODEL_M2) {
      setConfirm({
        title: 'Eliminar del modelo 3D',
        message: `Vas a quitar ${n(sel.triangles)} triángulos (${m2(sel.areaM2)} de superficie) del escaneo. Dejarán de verse y de contar al generar el navmesh. Puedes deshacerlo o restaurarlo después.`,
        confirmLabel: 'Eliminar',
        danger: true,
        onConfirm: run,
      });
    } else run();
  }

  const blockedConnIds = useMemo(() => blockedConnectionIds(state.blocks), [state.blocks]);

  function blockNavSelection() {
    const viewer = getViewer();
    const sel = selection.nav;
    const conns = sel.connections.filter(id => !blockedConnIds.has(id));
    if (!viewer || (!sel.polys && !conns.length)) return;
    const run = () => {
      const polygons = viewer.takeNavPolygons();
      const added: LocalBlock[] = [];
      if (polygons.length) {
        added.push({
          localId: tempId(), kind: 'AREA', polygons,
          label: `Zona bloqueada ${state.blocks.filter(b => b.kind === 'AREA').length + 1} · ${m2(sel.areaM2)}`,
        });
      }
      for (const id of conns) {
        const c = connections.find(x => x.id === id);
        added.push({ localId: tempId(), kind: 'CONNECTION', connectionId: id, label: `${c?.label ?? 'Conexión'} bloqueada` });
      }
      apply({ ...state, blocks: [...state.blocks, ...added] });
      viewer.clearSelection();
    };
    if (sel.polys > CONFIRM_POLYS || sel.areaM2 > CONFIRM_NAV_M2) {
      setConfirm({
        title: 'Bloquear zona de la malla',
        message: `Vas a bloquear ${n(sel.polys)} polígonos (${m2(sel.areaM2)}). Al regenerar, las rutas no pasarán por ahí.`,
        confirmLabel: 'Bloquear',
        danger: true,
        onConfirm: run,
      });
    } else run();
  }

  function unblockNavSelection() {
    const viewer = getViewer();
    const ids = new Set(selection.nav.blocks);
    const conns = new Set(selection.nav.connections);
    const next = state.blocks.filter(b => !ids.has(b.localId) && !(b.kind === 'CONNECTION' && conns.has(b.connectionId!)));
    if (next.length === state.blocks.length) return;
    apply({ ...state, blocks: next });
    viewer?.clearSelection();
  }

  const canBlock = selection.nav.polys > 0 || selection.nav.connections.some(id => !blockedConnIds.has(id));
  const canUnblock = selection.nav.blocks.length > 0 || selection.nav.connections.some(id => blockedConnIds.has(id));

  function primaryAction() {
    if (mode === 'model') deleteModelSelection();
    else if (canBlock) blockNavSelection();
    else if (canUnblock) unblockNavSelection();
  }

  const restoreScanEdit = (localId: string) => apply({ ...state, scanEdits: state.scanEdits.filter(e => e.localId !== localId) });
  const removeBlock = (localId: string) => apply({ ...state, blocks: state.blocks.filter(b => b.localId !== localId) });
  const renameScanEdit = (localId: string, label: string) =>
    setWorking({ ...state, scanEdits: state.scanEdits.map(e => (e.localId === localId && !e.id ? { ...e, label } : e)) });
  const renameBlock = (localId: string, label: string) =>
    setWorking({ ...state, blocks: state.blocks.map(b => (b.localId === localId && !b.id ? { ...b, label } : b)) });

  // ── Corte de paso ────────────────────────────────────────

  /** Clic en el visor con la herramienta de corte; devuelve true si lo usó. */
  function handlePick(p: ArPoint): boolean {
    if (!active || mode !== 'nav' || navTool !== 'barrier') return false;
    // Sobre el piso: el corte se aplica ±1 m alrededor de la altura de cada punto
    const floorY = getViewer()?.floorAt(p.x, p.z, p.y) ?? null;
    const point = floorY === null ? p : { ...p, y: Math.round(floorY * 1000) / 1000 };
    setBarrier(b => [...(b ?? []), point]);
    return true;
  }

  function finishBarrier() {
    if (!barrier || barrier.length < 2) { setBarrier(null); return; }
    const count = state.blocks.filter(b => b.kind === 'BARRIER').length + 1;
    apply({ ...state, blocks: [...state.blocks, { localId: tempId(), kind: 'BARRIER', line: barrier, label: `Corte de paso ${count}` }] });
    setBarrier(null);
  }

  // ── Guardar ──────────────────────────────────────────────

  async function persist() {
    setSaving(true);
    setError(null);
    let current = state;
    try {
      for (const e of changes.restoredScanEdits) await mapEditService.deleteScanEdit(e.id!);
      for (const b of changes.removedBlocks) await mapEditService.deleteBlock(b.id!);
      for (const e of changes.newScanEdits) {
        const created = await mapEditService.createScanEdit(scanEditBody(e));
        // Ya guardada: si algo falla después, reintentar no la duplica
        current = { ...current, scanEdits: current.scanEdits.map(x => (x.localId === e.localId ? { ...created, localId: e.localId } : x)) };
        setWorking(current);
      }
      for (const b of changes.newBlocks) {
        const created = await mapEditService.createBlock(blockBody(b));
        current = { ...current, blocks: current.blocks.map(x => (x.localId === b.localId ? { ...created, localId: b.localId } : x)) };
        setWorking(current);
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['scan-edits'] }),
        qc.invalidateQueries({ queryKey: ['nav-blocks'] }),
      ]);
      setWorking(null);
    } catch (err) {
      setError(`No se pudieron guardar todos los cambios: ${resolveApiError(err)}`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['scan-edits'] }),
        qc.invalidateQueries({ queryKey: ['nav-blocks'] }),
      ]);
    } finally {
      setUndoStack([]);
      setRedoStack([]);
      setRevision(r => r + 1);
      setSaving(false);
    }
  }

  function save() {
    if (!unsaved || saving) return;
    const parts = [
      changes.newScanEdits.length && `${changes.newScanEdits.length} limpieza(s) del modelo`,
      changes.restoredScanEdits.length && `${changes.restoredScanEdits.length} limpieza(s) restaurada(s)`,
      changes.newBlocks.length && `${changes.newBlocks.length} bloqueo(s) nuevo(s)`,
      changes.removedBlocks.length && `${changes.removedBlocks.length} bloqueo(s) quitado(s)`,
    ].filter(Boolean);
    setConfirm({
      title: 'Guardar cambios',
      message: `Se guardarán ${parts.join(', ')}. Para que las rutas de la app los usen, después regenera y publica el navmesh en la pestaña «Navegación».`,
      confirmLabel: 'Guardar',
      onConfirm: () => { void persist(); },
    });
  }

  function discard() {
    if (!unsaved) return;
    setConfirm({
      title: 'Descartar cambios',
      message: `Se perderán ${changeCount} cambio(s) sin guardar.`,
      confirmLabel: 'Descartar',
      danger: true,
      onConfirm: () => {
        setWorking(null);
        setUndoStack([]);
        setRedoStack([]);
        setRevision(r => r + 1);
        getViewer()?.clearSelection();
      },
    });
  }

  // ── Atajos ───────────────────────────────────────────────

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyRef.current = (e: KeyboardEvent) => {
      if (isTyping(e.target) || confirm) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && key === 'y') { e.preventDefault(); redo(); return; }
      if (mod || e.altKey) return;
      if (barrier) {
        if (e.key === 'Enter') { e.preventDefault(); finishBarrier(); return; }
        if (e.key === 'Escape') { setBarrier(null); return; }
        if (e.key === 'Backspace') { e.preventDefault(); setBarrier(b => (b && b.length > 1 ? b.slice(0, -1) : null)); return; }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); primaryAction(); return; }
      if (e.key === 'Escape') { getViewer()?.clearSelection(); return; }
      const i = ['1', '2', '3'].indexOf(e.key);
      if (i >= 0) setTool((mode === 'model' ? MODEL_TOOLS : NAV_TOOLS)[i]);
    };
  });

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  // Cerrar o recargar con cambios sin guardar
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  // ── Para el visor y la generación ───────────────────────

  const viewerScanEdits = useMemo<ViewerScanEdit[]>(
    () => state.scanEdits.map(e => ({ key: e.localId, meshes: e.meshes })),
    [state.scanEdits],
  );

  const viewerBlocks = useMemo<ViewerBlock[]>(() => {
    const selected = new Set(active && mode === 'nav' ? selection.nav.blocks : []);
    const list: ViewerBlock[] = state.blocks
      .filter(b => b.kind !== 'CONNECTION')
      .map(b => ({ id: b.localId, label: b.label, kind: b.kind, polygons: b.polygons, line: b.line, selected: selected.has(b.localId) }));
    if (barrier?.length) list.push({ id: 'draft', label: 'Nuevo corte', kind: 'BARRIER', line: barrier, selected: true, draft: true });
    return list;
  }, [state.blocks, barrier, selection.nav.blocks, active, mode]);

  const forBuild = useMemo(() => ({
    blocked: blockedAreas(state.blocks),
    blockedConnections: blockedConnIds,
  }), [state.blocks, blockedConnIds]);

  return {
    loading: scanQ.isLoading || blocksQ.isLoading,
    loadError: scanQ.isError || blocksQ.isError,
    scanEdits: state.scanEdits,
    blocks: state.blocks,
    mode,
    setMode,
    tool,
    setTool,
    toolSize: tool === 'brush' ? brushSize : reach,
    brushSize,
    setBrushSize,
    reach,
    setReach,
    visibleOnly,
    setVisibleOnly,
    showRemoved,
    setShowRemoved,
    selection,
    setSelection,
    clearSelection: () => getViewer()?.clearSelection(),
    deleteModelSelection,
    blockNavSelection,
    unblockNavSelection,
    canBlock,
    canUnblock,
    restoreScanEdit,
    removeBlock,
    renameScanEdit,
    renameBlock,
    barrier,
    finishBarrier,
    cancelBarrier: () => setBarrier(null),
    undoBarrierPoint: () => setBarrier(b => (b && b.length > 1 ? b.slice(0, -1) : null)),
    handlePick,
    pickPlaneY: barrier?.length ? barrier[barrier.length - 1].y : null,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    unsaved,
    changeCount,
    save,
    saving,
    discard,
    error,
    setError,
    confirm,
    closeConfirm: () => setConfirm(null),
    mismatched,
    setMismatched,
    revision,
    blockedConnIds,
    viewerScanEdits,
    viewerBlocks,
    forBuild,
    focusOf: (b: LocalBlock) => blockCenter(b),
  };
}

export type MapEditor = ReturnType<typeof useMapEditor>;
