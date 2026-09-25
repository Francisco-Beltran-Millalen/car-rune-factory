// Layout de la app + composición de sesión, modo, renderer y paneles (CONTRATOS.md §6).

import { h, clear } from './dom.js';
import { createControlsPanel } from './ui/controls.js';
import { createFaultsPanel } from './ui/faults.js';
import { createReadoutsPanel } from './ui/readouts.js';
import { createInfoPanel, createNarrationBar } from './ui/infoPanel.js';
import { createTimebar } from './ui/timebar.js';
import { createSession } from '../game/session.js';
import { createLabMode } from '../game/modes/lab.js';
import { createQuizMode } from '../game/modes/quiz.js';
import { createSave } from '../game/save.js';
import { stages as campaignStages, getStage, isStageUnlocked, nextStageOf } from '../game/campaign.js';
import { createLegacyRenderer } from '../render/legacy/index.js';
import { intents, INTENT_TYPES } from '../game/intents.js';
import { createHud } from '../ui/hud.js';
import { createRng } from './rng.ts';
import { parseHash } from './router.js';

const NARRATE_EVERY = 0.25; // s reales
const SYNC_EVERY = 0.1;
const SPARK_EVERY = 0.2;

const THEMES = ['auto', 'light', 'dark'];
const THEME_ICON = { auto: '◐', light: '☀', dark: '☾' };

const MODES = {
  lab: createLabMode,
  quiz: createQuizMode,
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
 * @param {import('./types.ts').ModuleDescriptor[]} modules  ordenados por `order`
 * @param {{ go: (target: any) => void }} nav
 */
export function createShell(root, modules, nav) {
  const save = createSave();
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
  const narrationBar = h('footer', { class: 'narration-bar' }, h('strong', {}, '¿Qué está pasando? '), narration);
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
      narrationBar,
    ),
  );

  for (const m of modules) {
    navList.append(h('a', { href: `#/lab/${m.id}`, class: 'navlink', dataset: { id: m.id } }, m.title));
  }

  let current = null;
  let currentMount = null; // { module, stage } de lo montado, para reintentar
  let attempt = 0;

  function setActiveNav(id) {
    for (const a of navList.children) a.classList.toggle('active', a.dataset.id === id);
  }

  /** Tarjeta de etapa: desbloqueada (enlace + estrellas) o bloqueada. */
  function stageCard(st) {
    const data = save.get();
    const rec = data.stages?.[st.id];
    if (!isStageUnlocked(st, data)) {
      const need = (st.unlockAfter || []).map((id) => getStage(id)?.title || id).join(', ');
      return h(
        'div',
        { class: 'card stage-card locked' },
        h('h2', {}, `🔒 ${st.title}`),
        h('p', {}, st.brief),
        h('p', { class: 'muted' }, `Se abre al completar: ${need}`),
      );
    }
    const stars = '★'.repeat(rec?.stars || 0) + '☆'.repeat(3 - (rec?.stars || 0));
    return h(
      'a',
      { class: 'card stage-card', href: `#/stage/${st.id}` },
      h('h2', {}, st.title),
      h('p', {}, st.brief),
      h('p', { class: 'muted stage-stars' }, rec ? `${stars} · mejor puntaje: ${rec.bestScore}` : 'Sin jugar todavía'),
    );
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
        h('h2', { class: 'home-h' }, 'Etapas'),
        h('div', { class: 'cards' }, campaignStages.map(stageCard)),
        h('h2', { class: 'home-h' }, 'Laboratorio'),
        h('div', { class: 'cards' }, cards),
      ),
    );
  }

  /**
   * @param {import('./types.ts').ModuleDescriptor|{ module: import('./types.ts').ModuleDescriptor, stage: any, attempt?: number }} target
   */
  function mount(target) {
    unmount();
    root.firstChild.classList.remove('home');

    const desc = target?.createModel ? target : target.module;
    const stageDef = target?.createModel ? null : target?.stage || null;
    attempt = target?.attempt ?? 0;
    currentMount = stageDef ? { module: desc, stage: stageDef } : null;

    modTitle.textContent = stageDef ? `${desc.title} — ${stageDef.title}` : desc.title;
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
      rng: stageDef ? createRng((stageDef.seed ?? 1) ^ attempt) : null,
      save,
    });

    const hudSec = stageDef ? section('Etapa') : null;
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

    if (hudSec) side.append(hudSec.node);
    side.append(ctlSec.node);
    if (presetSec) side.append(presetSec.node);
    side.append(faultSec.node, roSec.node, infoSec.node);

    const hud = hudSec ? createHud(hudSec.body, emit) : null;
    let lastUiSnapshot = JSON.stringify(mode.ui);
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
      // Un modo con estado oculto en el modelo (la falla del diagnóstico) lo re-aplica en onReset.
      if (typeof mode.onReset === 'function') mode.onReset();
      else session.reset();
      presetNote.textContent = '';
      renderer.highlight([]);
      if (hud) hud.update(mode.hud());
      syncAll();
    }

    /** Aplica los eventos que devuelven handle()/update() del modo. */
    function applyEvents(events) {
      for (const ev of events || []) {
        if (ev.type === 'highlight') {
          renderer.highlight(ev.data?.partIds || [], ev.data?.style || 'selected');
        } else if (ev.type === 'uiChanged') {
          lastUiSnapshot = JSON.stringify(mode.ui);
          applyUi(mode.ui);
        }
      }
    }

    function emit(intent) {
      const events = mode.handle(intent);
      if (intent.type === INTENT_TYPES.applyPreset && presetNote) {
        presetNote.textContent = mode.activePreset?.note || '';
      }
      if (intent.type === INTENT_TYPES.selectPart && mode.ui.infoPanel) {
        const partId = intent.partId;
        info.show(partId);
        if (partId) infoSec.node.open = true;
        renderer.highlight(partId ? [partId] : [], 'selected');
      }
      applyEvents(events);
      if (intent.type !== INTENT_TYPES.hoverPart) syncAll();

      if (intent.type === INTENT_TYPES.retry && currentMount) {
        mount({ ...currentMount, attempt: attempt + 1 });
        return;
      }
      if (intent.type === INTENT_TYPES.quit) {
        nav.go(null);
        return;
      }
      if (intent.type === INTENT_TYPES.nextStage && currentMount) {
        const next = nextStageOf(currentMount.stage.id);
        nav.go(next ? { kind: 'stage', id: next.id } : null);
        return;
      }
      if (hud) hud.update(mode.hud());
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
      narrationBar.hidden = ui.narration === 'off';
      if (ui.timebar?.maxScale) timebar.setMaxScale(ui.timebar.maxScale);
    }

    const timebar = createTimebar(timebarSlot, { loop: session.loop, onReset: resetAll });

    let tSync = 0;
    let tNarr = 0;
    let tSpark = 0;
    let tUiCheck = 0;
    let lastReal = performance.now();

    applyUi(mode.ui);
    syncAll();
    readouts.update(session.model.state);
    narr.set(desc.narrate ? desc.narrate(session.model) : []);
    if (hud) hud.update(mode.hud());
    applyEvents(mode.update(0)); // anuncio inicial del modo (p. ej. la pieza a nombrar)

    const unframe = session.onFrame((simDt) => {
      const now = performance.now();
      const real = (now - lastReal) / 1000;
      lastReal = now;

      applyEvents(mode.update(simDt));
      renderer.update(null, simDt);
      readouts.update(session.model.state);
      timebar.setClock(session.model.time);

      if ((tSync += real) >= SYNC_EVERY) {
        tSync = 0;
        controls.sync();
        faults.sync();
        if (hud) hud.update(mode.hud());
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
      save,
      destroy() {
        unframe();
        session.destroy();
        mode.destroy();
        renderer.destroy();
        timebar.destroy();
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
    narrationBar.hidden = false;
    tooltip.hidden = true;
    currentMount = null;
  }

  return {
    mount,
    route(target) {
      if (!target) {
        showHome();
        return;
      }
      let kind;
      let id;
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
        const stageDef = getStage(id);
        const desc = stageDef ? modules.find((m) => m.id === stageDef.module) : null;
        if (stageDef && desc && isStageUnlocked(stageDef, save.get())) {
          mount({ module: desc, stage: stageDef, attempt: 0 });
        } else {
          nav.go(null);
          showHome();
        }
      }
    },
    unmount,
  };
}
