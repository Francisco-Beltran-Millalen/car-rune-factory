// Layout de la app + montaje/desmontaje de módulos (CONTRATOS.md 4.8).

import { h, clear } from './dom.js';
import { el, arrowMarkers } from './svg.js';
import { createLoop } from './loop.js';
import { createRecorder } from './history.js';
import { createControlsPanel } from './ui/controls.js';
import { createFaultsPanel } from './ui/faults.js';
import { createReadoutsPanel } from './ui/readouts.js';
import { createInfoPanel, createNarrationBar } from './ui/infoPanel.js';
import { createTimebar } from './ui/timebar.js';

const NARRATE_EVERY = 0.25; // s reales
const SYNC_EVERY = 0.1;
const SPARK_EVERY = 0.2;

const THEMES = ['auto', 'light', 'dark'];
const THEME_ICON = { auto: '◐', light: '☀', dark: '☾' };

function loadTheme() {
  try {
    return localStorage.getItem('theme') || 'auto';
  } catch {
    return 'auto';
  }
}
function applyTheme(t) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  try {
    localStorage.setItem('theme', t);
  } catch {
    /* sin almacenamiento: el tema dura sólo esta visita */
  }
}

function section(title, open = true) {
  const body = h('div', { class: 'section-body' });
  const node = h('details', { class: 'section', open }, h('summary', {}, title), body);
  return { node, body };
}

/**
 * @param {HTMLElement} root
 * @param {import('./types.js').ModuleDescriptor[]} modules  ordenados por `order`
 * @param {{ go: (id: string|null) => void }} nav
 */
export function createShell(root, modules, nav) {
  let theme = loadTheme();
  applyTheme(theme);
  const themeBtn = h('button', {
    type: 'button',
    class: 'btn',
    title: 'Tema',
    onclick: () => {
      theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
      applyTheme(theme);
      themeBtn.textContent = THEME_ICON[theme];
    },
  });
  themeBtn.textContent = THEME_ICON[theme];

  const timebarSlot = h('div', { class: 'timebar-slot' });
  const navList = h('nav', { class: 'modnav' });
  const stage = h('div', { class: 'stage' });
  const tooltip = h('div', { class: 'tooltip', hidden: true });
  const side = h('aside', { class: 'side' });
  const narration = h('div', { class: 'narration', 'aria-live': 'polite' });
  const title = h('h1', { class: 'title' }, h('a', { href: '#/' }, 'Taller del motor'));
  const modTitle = h('span', { class: 'mod-title' });

  root.append(
    h(
      'div',
      { class: 'app' },
      h('header', { class: 'topbar' }, title, modTitle, timebarSlot, themeBtn),
      navList,
      h('main', { class: 'main' }, stage, tooltip),
      side,
      h('footer', { class: 'narration-bar' }, h('strong', {}, '¿Qué está pasando? '), narration),
    ),
  );

  for (const m of modules) {
    navList.append(h('a', { href: `#/${m.id}`, class: 'navlink', dataset: { id: m.id } }, m.title));
  }

  let current = null;

  function setActiveNav(id) {
    for (const a of navList.children) a.classList.toggle('active', a.dataset.id === id);
  }

  function showHome() {
    unmount();
    root.firstChild.classList.add('home');
    modTitle.textContent = '';
    setActiveNav(null);
    const cards = modules.map((m) =>
      h('a', { class: 'card', href: `#/${m.id}` }, h('h2', {}, m.title), h('p', {}, m.summary)),
    );
    stage.append(
      h(
        'div',
        { class: 'home-view' },
        h('p', { class: 'lead' }, 'Elige un sistema del auto para verlo funcionar, tocarlo y romperlo.'),
        h('div', { class: 'cards' }, cards),
      ),
    );
  }

  /** @param {import('./types.js').ModuleDescriptor} desc */
  function mount(desc) {
    unmount();
    root.firstChild.classList.remove('home');
    modTitle.textContent = desc.title;
    setActiveNav(desc.id);

    const svg = el('svg', {
      class: 'stage-svg',
      viewBox: desc.viewBox.join(' '),
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
      'aria-label': desc.title,
    });
    arrowMarkers(svg);
    stage.append(svg);

    const model = desc.createModel();
    const recorder = createRecorder(desc.readouts || []);
    const ctlSec = section('Controles');
    const presetSec = desc.presets?.length ? section('Casos para probar', false) : null;
    const faultSec = section('Fallas', false);
    const roSec = section('Mediciones');
    const infoSec = section('Pieza seleccionada');
    const info = createInfoPanel(infoSec.body, desc.parts || {});
    const narr = createNarrationBar(narration);

    let selected = null;
    const view = desc.createView({ svg, model, selectPart });

    function selectPart(id) {
      selected = id;
      for (const n of svg.querySelectorAll('.selected')) n.classList.remove('selected');
      if (id) for (const n of svg.querySelectorAll(`[data-part="${CSS.escape(id)}"]`)) n.classList.add('selected');
      view.highlight?.(id);
      info.show(id);
      infoSec.node.open = true;
    }

    // Delegación: cualquier [data-part] es clickeable sin que la vista cablee nada (§10).
    const onClick = (e) => {
      const p = e.target.closest?.('[data-part]');
      selectPart(p && p.dataset.part !== selected ? p.dataset.part : null);
    };
    const onMove = (e) => {
      const p = e.target.closest?.('[data-part]');
      const name = p && desc.parts?.[p.dataset.part]?.name;
      if (!name) {
        tooltip.hidden = true;
        return;
      }
      const r = stage.getBoundingClientRect();
      tooltip.textContent = name;
      tooltip.hidden = false;
      tooltip.style.left = `${e.clientX - r.left + 14}px`;
      tooltip.style.top = `${e.clientY - r.top + 14}px`;
    };
    const onLeave = () => (tooltip.hidden = true);
    svg.addEventListener('click', onClick);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerleave', onLeave);

    // Panel lateral
    side.append(ctlSec.node);
    if (presetSec) side.append(presetSec.node);
    side.append(faultSec.node, roSec.node, infoSec.node);

    const controls = createControlsPanel(ctlSec.body, desc.controls || [], model);
    const faults = createFaultsPanel(faultSec.body, desc.faults || [], model);
    const readouts = createReadoutsPanel(roSec.body, desc.readouts || [], recorder);

    const presetNote = h('p', { class: 'preset-note' });
    if (presetSec) {
      for (const p of desc.presets) {
        presetSec.body.append(
          h('button', { type: 'button', class: 'btn preset', onclick: () => applyPreset(p) }, p.label),
        );
      }
      presetSec.body.append(presetNote);
    }

    function syncAll() {
      controls.sync();
      faults.sync();
      timebar.sync();
    }

    function resetAll() {
      model.reset();
      recorder.clear();
      presetNote.textContent = '';
      syncAll();
    }

    function applyPreset(p) {
      model.reset();
      recorder.clear();
      Object.assign(model.params, p.params || {});
      Object.assign(model.faults, p.faults || {});
      for (const [name, args] of Object.entries(p.setup || {})) model.actions?.[name]?.(...(args || []));
      presetNote.textContent = p.note || '';
      syncAll();
    }

    let tSync = 0;
    let tNarr = 0;
    let tSpark = 0;
    let lastReal = performance.now();
    const loop = createLoop({
      model,
      onFrame(simDt) {
        const now = performance.now();
        const real = (now - lastReal) / 1000;
        lastReal = now;
        view.update(simDt);
        recorder.sample(model);
        readouts.update(model.state);
        timebar.setClock(model.time);
        if ((tSync += real) >= SYNC_EVERY) {
          tSync = 0;
          controls.sync();
          faults.sync();
        }
        if ((tSpark += real) >= SPARK_EVERY) {
          tSpark = 0;
          readouts.updateSparks();
        }
        if ((tNarr += real) >= NARRATE_EVERY) {
          tNarr = 0;
          narr.set(desc.narrate ? desc.narrate(model) : []);
        }
      },
    });
    const timebar = createTimebar(timebarSlot, { loop, onReset: resetAll });

    syncAll();
    readouts.update(model.state);
    narr.set(desc.narrate ? desc.narrate(model) : []);
    loop.start();

    current = {
      model,
      loop,
      destroy() {
        loop.destroy();
        timebar.destroy();
        view.destroy();
        svg.removeEventListener('click', onClick);
        svg.removeEventListener('pointermove', onMove);
        svg.removeEventListener('pointerleave', onLeave);
      },
    };
    // Acceso de depuración desde la consola: window.__sim.model.state
    window.__sim = current;
  }

  function unmount() {
    if (current) {
      current.destroy();
      current = null;
      delete window.__sim;
    }
    clear(stage);
    clear(side);
    clear(narration);
    tooltip.hidden = true;
  }

  return {
    route(id) {
      const desc = modules.find((m) => m.id === id);
      if (desc) mount(desc);
      else {
        if (id) nav.go(null);
        showHome();
      }
    },
    unmount,
  };
}
