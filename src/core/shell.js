// Layout de la app + composición de sesión, modo, renderer y paneles (CONTRATOS.md §6).

import { h, clear } from './dom.js';
import { createControlsPanel } from './ui/controls.js';
import { createFaultsPanel } from './ui/faults.js';
import { createReadoutsPanel } from './ui/readouts.js';
import { createInfoPanel, createNarrationBar } from './ui/infoPanel.js';
import { createTimebar } from './ui/timebar.js';
import { createSession } from '../game/session.js';
import { createLabMode } from '../game/modes/lab.js';
import { createLegacyRenderer } from '../render/legacy/index.js';
import { intents, INTENT_TYPES } from '../game/intents.js';
import { parseHash } from './router.js';

const NARRATE_EVERY = 0.25; // s reales
const SYNC_EVERY = 0.1;
const SPARK_EVERY = 0.2;

const THEMES = ['auto', 'light', 'dark'];
const THEME_ICON = { auto: '◐', light: '☀', dark: '☾' };

const MODES = {
  lab: createLabMode,
};

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
 * @param {{ go: (target: any) => void }} nav
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
    navList.append(h('a', { href: `#/lab/${m.id}`, class: 'navlink', dataset: { id: m.id } }, m.title));
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
      h('a', { class: 'card', href: `#/lab/${m.id}` }, h('h2', {}, m.title), h('p', {}, m.summary)),
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

  /**
   * @param {import('./types.js').ModuleDescriptor|{ module: import('./types.js').ModuleDescriptor, stage: any }} target
   */
  function mount(target) {
    unmount();
    root.firstChild.classList.remove('home');

    const desc = target?.createModel ? target : target.module;
    const stageDef = target?.createModel ? null : target?.stage || null;

    modTitle.textContent = desc.title;
    setActiveNav(desc.id);

    const session = createSession({
      createModel: desc.createModel,
      readouts: desc.readouts || [],
    });

    const modeKey = stageDef?.mode ?? 'lab';
    const modeFactory = MODES[modeKey] || createLabMode;
    const mode = modeFactory({
      session,
      module: desc,
      stage: stageDef,
      rng: null,
      save: null,
    });

    const ctlSec = section('Controles');
    const presetSec = desc.presets?.length ? section('Casos para probar', false) : null;
    const faultSec = section('Fallas', false);
    const roSec = section('Mediciones');
    const infoSec = section('Pieza seleccionada');
    const info = createInfoPanel(infoSec.body, desc.parts || {});
    const narr = createNarrationBar(narration);

    const renderer = createLegacyRenderer({
      container: stage,
      module: desc,
      emit,
      model: session.model,
      tooltip,
    });

    side.append(ctlSec.node);
    if (presetSec) side.append(presetSec.node);
    side.append(faultSec.node, roSec.node, infoSec.node);

    const controls = createControlsPanel(
      ctlSec.body,
      desc.controls || [],
      (k) => session.model.params[k],
      emit,
      session.model,
    );
    const faults = createFaultsPanel(
      faultSec.body,
      desc.faults || [],
      (k) => session.model.faults[k],
      emit,
      desc.defaultFaults,
    );
    const readouts = createReadoutsPanel(roSec.body, desc.readouts || [], session.recorder);

    const presetNote = h('p', { class: 'preset-note' });
    if (presetSec) {
      for (const p of desc.presets) {
        presetSec.body.append(
          h(
            'button',
            {
              type: 'button',
              class: 'btn preset',
              onclick: () => emit(intents.applyPreset(p.id)),
            },
            p.label,
          ),
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
      session.reset();
      presetNote.textContent = '';
      syncAll();
    }

    function emit(intent) {
      const events = mode.handle(intent);
      if (intent.type === INTENT_TYPES.applyPreset) {
        if (presetNote) presetNote.textContent = mode.activePreset?.note || '';
      }
      if (intent.type === INTENT_TYPES.selectPart) {
        const partId = intent.partId;
        if (mode.ui.infoPanel) {
          info.show(partId);
          if (partId) infoSec.node.open = true;
        }
        renderer.highlight(partId ? [partId] : [], 'selected');
      }
      for (const ev of events) {
        if (ev.type === 'feedback' && ev.text && presetNote) {
          presetNote.textContent = ev.text;
        }
      }
      syncAll();
    }

    function applyUi(ui) {
      renderer.applyUi(ui);
      ctlSec.node.hidden = Array.isArray(ui.controls) && ui.controls.length === 0;
      controls.setVisible(ui.controls);
      faultSec.node.hidden = ui.faults === 'none' || (Array.isArray(ui.faults) && ui.faults.length === 0);
      faults.setVisible(ui.faults);
      roSec.node.hidden = Array.isArray(ui.readouts) && ui.readouts.length === 0;
      readouts.setVisible(ui.readouts);
      if (presetSec) presetSec.node.hidden = !ui.presets;
      infoSec.node.hidden = !ui.infoPanel;
      if (ui.timebar?.maxScale) timebar.setMaxScale(ui.timebar.maxScale);
    }

    const timebar = createTimebar(timebarSlot, { loop: session.loop, onReset: resetAll });

    let tSync = 0;
    let tNarr = 0;
    let tSpark = 0;
    let tUiCheck = 0;
    let lastReal = performance.now();
    let lastUiSnapshot = JSON.stringify(mode.ui);

    applyUi(mode.ui);
    syncAll();
    readouts.update(session.model.state);
    narr.set(desc.narrate ? desc.narrate(session.model) : []);

    const unframe = session.onFrame((simDt) => {
      const now = performance.now();
      const real = (now - lastReal) / 1000;
      lastReal = now;

      mode.update(simDt);
      renderer.update(null, simDt);
      readouts.update(session.model.state);
      timebar.setClock(session.model.time);

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
        if (mode.ui.narration === 'off') {
          narr.set([]);
        } else {
          narr.set(desc.narrate ? desc.narrate(session.model) : []);
        }
      }
      if ((tUiCheck += real) >= 0.1) {
        tUiCheck = 0;
        const snap = JSON.stringify(mode.ui);
        if (snap !== lastUiSnapshot) {
          lastUiSnapshot = snap;
          applyUi(mode.ui);
        }
      }
    });

    session.start();

    current = {
      session,
      model: session.model,
      mode,
      renderer,
      destroy() {
        unframe();
        session.destroy();
        mode.destroy();
        renderer.destroy();
        timebar.destroy();
      },
    };
    // Acceso de depuración desde la consola (§148): window.__sim.model.state
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
    mount,
    route(target) {
      if (!target) {
        showHome();
        return;
      }
      let kind = 'lab';
      let id = null;
      if (typeof target === 'string') {
        const parsed = parseHash(target.startsWith('#') ? target : `#/lab/${target}`);
        kind = parsed.kind;
        id = parsed.id;
      } else {
        kind = target.kind;
        id = target.id;
      }

      if (kind === 'home' || !id) {
        showHome();
        return;
      }

      if (kind === 'lab') {
        const desc = modules.find((m) => m.id === id);
        if (desc) {
          mount({ module: desc, stage: null });
        } else {
          nav.go(null);
          showHome();
        }
      } else if (kind === 'stage') {
        showHome();
      }
    },
    unmount,
  };
}
