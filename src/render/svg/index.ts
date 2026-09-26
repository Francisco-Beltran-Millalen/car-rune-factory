// Renderer SVG genérico (A7, CONTRATOS 6.4): dibuja un `CircuitDef` con un
// drawer por tipo visual y anima el `VisualState` del presenter. Sólo lee el
// circuito y el VisualState (§22).

import { createFlow, PX_PER_LH, type Flow } from '../../core/particles.ts';
import { arrowMarkers, el, group, pipe, type Point } from '../../core/svg.ts';
import type { ModuleDescriptor, VisualState } from '../../core/types.ts';
import type { CircuitDef, CircuitLinkDef } from '../../sim/circuit/types.ts';
import { intents, type Intent } from '../../game/intents.ts';
import type { HighlightStyle, ModeUi } from '../../game/types.ts';
import { DRAWERS } from './drawers/index.ts';
import { autoRoute } from './route.ts';
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

  const drawers = new Map<string, Drawer>();
  const partPorts = new Map<string, Readonly<Record<string, Point>>>();
  for (const part of circuit.parts) {
    const factory = DRAWERS[part.visual ?? part.type];
    if (!factory) continue;
    const drawer = factory({ part, def: circuit, layers });
    drawers.set(part.id, drawer);
    if (drawer.ports) partPorts.set(part.id, drawer.ports);
  }

  function portPoint(endpoint: string): Point | null {
    const dot = endpoint.indexOf('.');
    const part = dot < 0 ? endpoint : endpoint.slice(0, dot);
    const port = dot < 0 ? '' : endpoint.slice(dot + 1);
    return partPorts.get(part)?.[port] ?? null;
  }

  const links: LinkView[] = [];
  for (const link of circuit.links) {
    if (!link.visual && !link.route) continue;
    let route: readonly Point[] = link.route ?? [];
    if (route.length < 2) {
      const from = portPoint(link.from);
      const to = portPoint(link.to);
      if (!from || !to) continue;
      route = autoRoute(from, to);
    }
    const vis = link.visual;
    const parts = pipe(layers.pipes, route, {
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
