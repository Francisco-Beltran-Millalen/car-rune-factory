// Adaptador del módulo legacy a la interfaz Renderer (CONTRATOS.md §6.4).
// Envuelve module.createView; única pieza autorizada a leer model (§22, temporal hasta A7).

import { arrowMarkers, el } from '../../core/svg.ts';
import type { Model, ModuleDescriptor } from '../../core/types.ts';
import { intents, type Intent } from '../../game/intents.ts';
import type { HighlightStyle, ModeUi } from '../../game/types.ts';

// Estilos de resaltado del contrato 6.4: al aplicar uno se limpian todos.
const HIGHLIGHT_STYLES: readonly HighlightStyle[] = ['selected', 'correct', 'wrong', 'target'];

export interface Renderer {
  svg: SVGSVGElement;
  update(visual: unknown, dt: number): void;
  applyUi(ui: ModeUi): void;
  highlight(partIds?: readonly string[], style?: HighlightStyle): void;
  resize(): void;
  destroy(): void;
}

export interface LegacyRendererOptions {
  container: HTMLElement;
  module: ModuleDescriptor;
  emit: (intent: Intent) => void;
  model: Model;
  tooltip?: HTMLElement;
}

export function createLegacyRenderer({
  container,
  module,
  emit,
  model,
  tooltip,
}: LegacyRendererOptions): Renderer {
  let selectedPartId: string | null = null;
  let hoveredPartId: string | null = null;
  let currentUi: Pick<ModeUi, 'labels' | 'tooltips' | 'infoPanel'> = {
    labels: true,
    tooltips: true,
    infoPanel: false,
  };

  const svg = el('svg', {
    class: 'stage-svg',
    viewBox: module.viewBox.join(' '),
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': module.title,
  });
  arrowMarkers(svg);
  container.append(svg);

  const view = module.createView({
    svg,
    model,
    selectPart(id): void {
      selectedPartId = id;
      emit(intents.selectPart(id));
    },
  });

  const dataPart = (target: EventTarget | null): string | null => {
    const p = target instanceof Element ? target.closest<SVGElement>('[data-part]') : null;
    const id = p?.dataset['part'];
    return id === undefined || id === '' ? null : id;
  };

  const onClick = (e: MouseEvent): void => {
    const clickedId = dataPart(e.target);
    // El toggle (volver a clicar para deseleccionar) es del laboratorio; en el quiz
    // cada clic sobre una pieza es una respuesta, aunque repita la anterior.
    const newId = currentUi.infoPanel && clickedId && clickedId === selectedPartId ? null : clickedId;
    selectedPartId = newId;
    emit(intents.selectPart(newId));
  };

  const onMove = (e: PointerEvent): void => {
    const partId = dataPart(e.target);
    if (partId !== hoveredPartId) {
      hoveredPartId = partId;
      emit(intents.hoverPart(partId));
    }

    if (!currentUi.tooltips || !partId) {
      if (tooltip) tooltip.hidden = true;
      return;
    }
    const name = module.parts[partId]?.name;
    if (!name || !tooltip) {
      if (tooltip) tooltip.hidden = true;
      return;
    }
    const r = container.getBoundingClientRect();
    tooltip.textContent = name;
    tooltip.hidden = false;
    tooltip.style.left = `${e.clientX - r.left + 14}px`;
    tooltip.style.top = `${e.clientY - r.top + 14}px`;
  };

  const onLeave = (): void => {
    if (hoveredPartId !== null) {
      hoveredPartId = null;
      emit(intents.hoverPart(null));
    }
    if (tooltip) tooltip.hidden = true;
  };

  svg.addEventListener('click', onClick);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerleave', onLeave);

  return {
    svg,
    update(_visual, dt): void {
      view.update(dt);
    },
    applyUi(ui): void {
      currentUi = ui;
      const display = ui.labels ? '' : 'none';
      for (const n of svg.querySelectorAll<SVGElement>('.part-label')) n.style.display = display;
      if (!ui.tooltips && tooltip) {
        tooltip.hidden = true;
      }
    },
    highlight(partIds = [], style = 'selected'): void {
      for (const s of HIGHLIGHT_STYLES) {
        for (const n of svg.querySelectorAll(`.${s}`)) {
          n.classList.remove(s);
        }
      }
      for (const id of partIds) {
        if (!id) continue;
        for (const n of svg.querySelectorAll(`[data-part="${CSS.escape(id)}"]`)) {
          n.classList.add(style);
        }
      }
      view.highlight?.(partIds.length ? (partIds[0] ?? null) : null);
    },
    resize() {},
    destroy(): void {
      svg.removeEventListener('click', onClick);
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerleave', onLeave);
      view.destroy();
      svg.remove();
      if (tooltip) tooltip.hidden = true;
    },
  };
}
