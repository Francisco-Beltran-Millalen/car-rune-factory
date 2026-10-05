// Renderer SVG genérico (A7, CONTRATOS 6.4): dibuja un `CircuitDef` con un
// drawer por tipo visual y anima el `VisualState` del presenter. Sólo lee el
// circuito y el VisualState (§22).

import { createFlow, PX_PER_LH, type Flow } from '../../core/particles.ts';
import { arrowMarkers, el, group, pipe } from '../../core/svg.ts';
import type { ModuleDescriptor, VisualState } from '../../core/types.ts';
import type { CircuitDef, CircuitLinkDef } from '../../sim/circuit/types.ts';
import { intents, type Intent } from '../../game/intents.ts';
import type { HighlightStyle, ModeUi } from '../../game/types.ts';
import { DRAWERS } from './drawers/index.ts';
import { resolveLayout } from './layout.ts';
import { pressureOpacity } from './util.ts';
import type { Drawer, SvgLayers } from './types.ts';

const HIGHLIGHT_STYLES: readonly HighlightStyle[] = ['selected', 'correct', 'wrong', 'target'];
const EMPTY_LINK = { flow: 0, potential: 0, air: 0 } as const;

export interface Renderer {
  svg: SVGSVGElement;
  update(visual: VisualState, dt: number): void;
  applyUi(ui: ModeUi): void;
  highlight(partIds?: readonly string[], style?: HighlightStyle): void;
  resize(): void;
  destroy(): void;
}

export interface SvgRendererOptions {
  container: HTMLElement;
  circuit: CircuitDef;
  viewBox: readonly [number, number, number, number];
  module: ModuleDescriptor;
  emit: (intent: Intent) => void;
  tooltip?: HTMLElement;
}

interface LinkView {
  id: string;
  def: CircuitLinkDef;
  inner: SVGPathElement;
  flow: Flow | null;
}

/** Sub-piezas que un drawer marcó con un id propio (`points` dentro del
 *  distribuidor): en el vehículo llevan el prefijo de su sistema (§10). */
function scopeSubParts(svg: SVGSVGElement, before: ReadonlySet<Element>, scope: string, partId: string): void {
  for (const node of svg.querySelectorAll('[data-part]')) {
    if (before.has(node)) continue;
    const sub = node.getAttribute('data-part') ?? '';
    if (sub === '' || sub === partId || sub.startsWith(`${scope}:`)) continue;
    node.setAttribute('data-part', `${scope}:${sub}`); // mismo formato que `translateCircuit`
  }
}

export function createSvgRenderer({
  container,
  circuit,
  viewBox,
  module,
  emit,
  tooltip,
}: SvgRendererOptions): Renderer {
  let selectedPartId: string | null = null;
  let hoveredPartId: string | null = null;
  let currentUi: Pick<ModeUi, 'labels' | 'tooltips' | 'infoPanel'> = {
    labels: true,
    tooltips: true,
    infoPanel: false,
  };

  const svg = el('svg', {
    class: `stage-svg ${module.id}`,
    viewBox: viewBox.join(' '),
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': module.title,
  });
  arrowMarkers(svg);
  container.append(svg);

  // Orden del legacy: tubos, piezas de fondo, partículas, piezas, efectos.
  const layers: SvgLayers = {
    pipes: group(svg, { class: 'layer-pipes' }),
    behind: group(svg, { class: 'layer-behind' }),
    particles: group(svg, { class: 'layer-particles' }),
    parts: group(svg, { class: 'layer-parts' }),
    fx: group(svg, { class: 'layer-fx' }),
  };

  // Plan V1: las puntas de cada tubo salen de la geometría de los drawers.
  const layout = resolveLayout(circuit);
  const drawers = new Map<string, Drawer>();
  for (const [id, { part, geo }] of layout.parts) {
    const entry = DRAWERS[part.visual ?? part.type];
    if (!entry) continue;
    const before = part.scope === undefined ? null : new Set(svg.querySelectorAll('[data-part]'));
    drawers.set(id, entry.draw({ part, def: circuit, layers, geo }));
    if (before && part.scope !== undefined) scopeSubParts(svg, before, part.scope, part.id);
  }

  const links: LinkView[] = [];
  for (const { link, points } of layout.links) {
    if (!points) continue;
    const vis = link.visual;
    const parts = pipe(layers.pipes, points, {
      width: vis?.width ?? 10,
      className: vis?.pipeClass ?? 'fluid-fuel',
      ...(vis?.owner !== undefined ? { part: vis.owner } : {}),
    });
    const flow = vis?.flowClass
      ? createFlow({
          path: parts.path,
          layer: layers.particles,
          spacing: vis.spacing ?? 14,
          radius: vis.radius ?? 3,
          className: vis.flowClass,
        })
      : null;
    links.push({ id: link.id, def: link, inner: parts.inner, flow });
  }
  for (const node of layout.nodes.values()) {
    if (node.degree >= 3) el('circle', { cx: node.at[0], cy: node.at[1], r: 5, class: 'junction-dot' }, layers.parts);
  }

  const dataPart = (target: EventTarget | null): string | null => {
    const p = target instanceof Element ? target.closest<SVGElement>('[data-part]') : null;
    const id = p?.dataset['part'];
    return id === undefined || id === '' ? null : id;
  };

  const onClick = (e: MouseEvent): void => {
    const clickedId = dataPart(e.target);
    // El toggle (volver a clicar para deseleccionar) es del laboratorio; en el
    // quiz cada clic sobre una pieza es una respuesta, aunque repita la anterior.
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
    update(visual, dt): void {
      for (const [id, drawer] of drawers) drawer.update(visual.parts[id] ?? {}, dt);
      for (const link of links) {
        const values = visual.links[link.id] ?? EMPTY_LINK;
        const vis = link.def.visual;
        if (link.flow) {
          link.flow.setSpeed(values.flow * (vis?.scale ?? PX_PER_LH));
          link.flow.setDensity(Math.abs(values.flow) > 0.3 ? 1 : 0);
          link.flow.setAir(values.air);
          link.flow.update(dt);
        }
        const range = vis?.potentialRange;
        if (range) {
          const t = (values.potential - range[0]) / (range[1] - range[0] || 1);
          const tint = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
          link.inner.style.setProperty('--t', tint.toFixed(3));
          link.flow?.setTint(tint);
          link.inner.style.opacity = '0.9';
          continue;
        }
        const opacity =
          vis?.opacity ?? (values.potential > 0 ? pressureOpacity(values.potential) : undefined);
        if (opacity !== undefined) link.inner.style.opacity = String(opacity);
      }
    },
    applyUi(ui): void {
      currentUi = ui;
      const display = ui.labels ? '' : 'none';
      for (const n of svg.querySelectorAll<SVGElement>('.part-label')) n.style.display = display;
      if (!ui.tooltips && tooltip) tooltip.hidden = true;
    },
    highlight(partIds = [], style = 'selected'): void {
      for (const s of HIGHLIGHT_STYLES) {
        for (const n of svg.querySelectorAll(`.${s}`)) n.classList.remove(s);
      }
      for (const id of partIds) {
        if (!id) continue;
        for (const n of svg.querySelectorAll(`[data-part="${CSS.escape(id)}"]`)) {
          n.classList.add(style);
        }
      }
    },
    resize(): void {},
    destroy(): void {
      svg.removeEventListener('click', onClick);
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerleave', onLeave);
      for (const drawer of drawers.values()) drawer.destroy?.();
      for (const link of links) link.flow?.destroy();
      svg.remove();
      if (tooltip) tooltip.hidden = true;
    },
  };
}
