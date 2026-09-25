// Adaptador del módulo legacy a la interfaz Renderer (CONTRATOS.md §6.4).
// Envuelve module.createView; única pieza autorizada a leer model (§22, temporal hasta A7).

import { el, arrowMarkers } from '../../core/svg.js';
import { intents } from '../../game/intents.js';

// Estilos de resaltado del contrato 6.4: al aplicar uno se limpian todos.
const HIGHLIGHT_STYLES = ['selected', 'correct', 'wrong', 'target'];

/**
 * @param {Object} opts
 * @param {HTMLElement} opts.container
 * @param {import('../../core/types.ts').ModuleDescriptor} opts.module
 * @param {(intent: import('../../game/types.js').Intent) => void} opts.emit
 * @param {import('../../core/types.ts').Model} opts.model
 * @param {HTMLElement} [opts.tooltip]
 */
export function createLegacyRenderer({ container, module, emit, model, tooltip }) {
  let selectedPartId = null;
  let hoveredPartId = null;
  let currentUi = { labels: true, tooltips: true };

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
    selectPart(id) {
      selectedPartId = id;
      emit(intents.selectPart(id));
    },
  });

  const onClick = (e) => {
    const p = e.target.closest?.('[data-part]');
    const clickedId = p?.dataset.part || null;
    // El toggle (volver a clicar para deseleccionar) es del laboratorio; en el quiz
    // cada clic sobre una pieza es una respuesta, aunque repita la anterior.
    const newId = currentUi.infoPanel && clickedId && clickedId === selectedPartId ? null : clickedId;
    selectedPartId = newId;
    emit(intents.selectPart(newId));
  };

  const onMove = (e) => {
    const p = e.target.closest?.('[data-part]');
    const partId = p?.dataset.part || null;
    if (partId !== hoveredPartId) {
      hoveredPartId = partId;
      emit(intents.hoverPart(partId));
    }

    if (!currentUi.tooltips || !partId) {
      if (tooltip) tooltip.hidden = true;
      return;
    }
    const name = module.parts?.[partId]?.name;
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

  const onLeave = () => {
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
    update(_visual, dt) {
      view.update(dt);
    },
    applyUi(ui) {
      currentUi = ui;
      if (ui.labels === false) {
        for (const n of svg.querySelectorAll('.part-label')) {
          n.style.display = 'none';
        }
      } else {
        for (const n of svg.querySelectorAll('.part-label')) {
          n.style.display = '';
        }
      }
      if (ui.tooltips === false && tooltip) {
        tooltip.hidden = true;
      }
    },
    highlight(partIds = [], style = 'selected') {
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
      view.highlight?.(partIds.length ? partIds[0] : null);
    },
    resize() {},
    destroy() {
      svg.removeEventListener('click', onClick);
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerleave', onLeave);
      view.destroy?.();
      svg.remove();
      if (tooltip) tooltip.hidden = true;
    },
  };
}
