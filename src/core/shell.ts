// Layout de la app + composición de sesión, modo, renderer y paneles (CONTRATOS.md §6).

import type { Model, ModuleDescriptor, ParamValue, VisualState } from './types.ts';
import { h, clear } from './dom.ts';
import { createRng } from './rng.ts';
import { parseHash, type Route, type RouteTarget } from './router.ts';
import { createControlsPanel } from './ui/controls.ts';
import { createFaultsPanel } from './ui/faults.ts';
import { createReadoutsPanel } from './ui/readouts.ts';
import { createInfoPanel, createNarrationBar } from './ui/infoPanel.ts';
import { createTimebar } from './ui/timebar.ts';
import { createSession } from '../game/session.ts';
import { createLabMode } from '../game/modes/lab.ts';
import { createQuizMode, type QuizMode } from '../game/modes/quiz.ts';
import { createSave } from '../game/save.ts';
import { stages as campaignStages, getStage, isStageUnlocked, nextStageOf } from '../game/campaign.ts';
import { intents, INTENT_TYPES, type Intent } from '../game/intents.ts';
import { presentModel } from '../presenter/present.ts';
import { createSvgRenderer } from '../render/svg/index.ts';
import { createHud } from '../ui/hud.ts';
import type {
  LabMode,
  ModeContext,
  ModeEvent,
  ModeUi,
  SaveApi,
  Session,
  Stage,
} from '../game/types.ts';

const NARRATE_EVERY = 0.25; // s reales
const SYNC_EVERY = 0.1;
const SPARK_EVERY = 0.2;

type Theme = 'auto' | 'light' | 'dark';
const THEMES = ['auto', 'light', 'dark'] as const;
const THEME_ICON: Record<Theme, string> = { auto: '◐', light: '☀', dark: '☾' };

type AnyMode = LabMode | QuizMode;
type ModeFactory = (ctx: ModeContext) => AnyMode;

const MODES: Record<string, ModeFactory> = {
  lab: createLabMode,
  quiz: createQuizMode,
};

export interface Nav {
  go(target: string | RouteTarget | null): void;
}

type MountTarget =
  | { kind: 'lab'; module: ModuleDescriptor }
  | { kind: 'stage'; module: ModuleDescriptor; stage: Stage; attempt: number };

type Renderer = ReturnType<typeof createSvgRenderer>;

interface SimDebug {
  session: Session;
  model: Model;
  mode: AnyMode;
  renderer: Renderer;
  save: SaveApi;
  destroy(): void;
}

declare global {
  interface Window {
    /** Hook de depuración en la consola: `window.__sim.model.state` (shell). */
    __sim?: SimDebug;
  }
}

function loadTheme(): Theme {
  try {
    const t = localStorage.getItem('theme');
    const theme = t as Theme; // frontera localStorage: se valida con THEMES
    if (t !== null && THEMES.includes(theme)) return theme;
  } catch {
    /* sin almacenamiento */
  }
  return 'auto';
}

function applyTheme(t: Theme): void {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  try {
    localStorage.setItem('theme', t);
  } catch {
    /* sin almacenamiento: el tema dura sólo esta visita */
  }
}

function section(title: string, open = true): { node: HTMLDetailsElement; body: HTMLDivElement } {
  const body = h('div', { class: 'section-body' });
  const node = h('details', { class: 'section', open }, h('summary', {}, title), body);
  return { node, body };
}

export function createShell(
  root: HTMLElement,
  modules: readonly ModuleDescriptor[],
  nav: Nav,
): { mount(target: MountTarget): void; route(target: string | Route | null): void; unmount(): void } {
  const save = createSave();
  let theme = loadTheme();
  applyTheme(theme);
  const themeBtn = h('button', {
    type: 'button',
    class: 'btn',
    title: 'Tema',
    onclick: () => {
      theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length] ?? 'auto';
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

  let current: SimDebug | null = null;
  let currentMount: Extract<MountTarget, { kind: 'stage' }> | null = null;

  function setActiveNav(id: string | null): void {
    for (const a of navList.querySelectorAll<HTMLAnchorElement>('a.navlink')) {
      a.classList.toggle('active', a.dataset['id'] === id);
    }
  }

  /** Tarjeta de etapa: desbloqueada (enlace + estrellas) o bloqueada. */
  function stageCard(st: Stage): HTMLElement {
    const data = save.get();
    const rec = data.stages[st.id];
    if (!isStageUnlocked(st, data)) {
      const need = (st.unlockAfter ?? []).map((id) => getStage(id)?.title ?? id).join(', ');
      return h(
        'div',
        { class: 'card stage-card locked' },
        h('h2', {}, `🔒 ${st.title}`),
        h('p', {}, st.brief),
        h('p', { class: 'muted' }, `Se abre al completar: ${need}`),
      );
    }
    const stars = '★'.repeat(rec?.stars ?? 0) + '☆'.repeat(3 - (rec?.stars ?? 0));
    return h(
      'a',
      { class: 'card stage-card', href: `#/stage/${st.id}` },
      h('h2', {}, st.title),
      h('p', {}, st.brief),
      h('p', { class: 'muted stage-stars' }, rec ? `${stars} · mejor puntaje: ${rec.bestScore}` : 'Sin jugar todavía'),
    );
  }

  function showHome(): void {
    unmount();
    root.firstElementChild?.classList.add('home');
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

  function mount(target: MountTarget): void {
    unmount();
    root.firstElementChild?.classList.remove('home');

    const desc = target.module;
    const stageDef = target.kind === 'stage' ? target.stage : null;
    const attempt = target.kind === 'stage' ? target.attempt : 0;
    currentMount = target.kind === 'stage' ? { kind: 'stage', module: desc, stage: target.stage, attempt } : null;

    modTitle.textContent = stageDef ? `${desc.title} — ${stageDef.title}` : desc.title;
    setActiveNav(desc.id);

    const session = createSession({
      createModel: () => desc.createModel(),
      readouts: desc.readouts,
    });

    const modeKey = stageDef ? stageDef.mode : 'lab';
    const modeFactory = MODES[modeKey] ?? createLabMode;
    const mode: AnyMode = modeFactory({
      session,
      module: desc,
      stage: stageDef,
      ...(stageDef ? { rng: createRng(stageDef.seed ^ attempt) } : {}),
      save,
    });

    const hudSec = stageDef ? section('Etapa') : null;
    const ctlSec = section('Controles');
    const presetSec = desc.presets?.length ? section('Casos para probar', false) : null;
    const faultSec = section('Fallas', false);
    const roSec = section('Mediciones');
    const infoSec = section('Pieza seleccionada');
    const info = createInfoPanel(infoSec.body, desc.parts);
    const narr = createNarrationBar(narration);

    if (!desc.circuit) throw new Error(`el módulo ${desc.id} no tiene circuit (A7)`);
    const renderer = createSvgRenderer({
      container: stage,
      circuit: desc.circuit,
      viewBox: desc.viewBox,
      module: desc,
      emit,
      tooltip,
    });

    /** VisualState del frame: el presenter evalúa el esquema del módulo (§22). */
    function visualNow(): VisualState {
      return presentModel({
        scheme: desc.present ?? { parts: {} },
        catalog: desc.faultCatalog,
        model: session.model,
        revealedFaults: mode.ui.revealedFaults,
      });
    }

    if (hudSec) side.append(hudSec.node);
    side.append(ctlSec.node);
    if (presetSec) side.append(presetSec.node);
    side.append(faultSec.node, roSec.node, infoSec.node);

    const hud = hudSec ? createHud(hudSec.body, emit) : null;
    let lastUiSnapshot = JSON.stringify(mode.ui);
    const controls = createControlsPanel(
      ctlSec.body,
      desc.controls,
      (k): ParamValue | undefined => session.model.params[k],
      emit,
      session.model,
    );
    const faults = createFaultsPanel(
      faultSec.body,
      desc.faults,
      (k): ParamValue | undefined => session.model.faults[k],
      emit,
      desc.defaultFaults,
    );
    const readouts = createReadoutsPanel(roSec.body, desc.readouts, session.recorder);

    const presetNote = h('p', { class: 'preset-note' });
    if (presetSec) {
      for (const p of desc.presets ?? []) {
        presetSec.body.append(
          h(
            'button',
            {
              type: 'button',
              class: 'btn preset',
              onclick: () => {
                emit(intents.applyPreset(p.id));
              },
            },
            p.label,
          ),
        );
      }
      presetSec.body.append(presetNote);
    }

    function syncAll(): void {
      controls.sync();
      faults.sync();
      timebar.sync();
    }

    function resetAll(): void {
      // Un modo con estado oculto en el modelo (la falla del diagnóstico) lo re-aplica en onReset.
      if (mode.onReset) mode.onReset();
      else session.reset();
      presetNote.textContent = '';
      renderer.highlight([]);
      if (hud) hud.update(mode.hud());
      syncAll();
    }

    /** Aplica los eventos que devuelven handle()/update() del modo. */
    function applyEvents(events: readonly ModeEvent[]): void {
      for (const ev of events) {
        if (ev.type === 'highlight') {
          renderer.highlight(ev.data.partIds, ev.data.style);
        } else if (ev.type === 'uiChanged') {
          lastUiSnapshot = JSON.stringify(mode.ui);
          applyUi(mode.ui);
        }
      }
    }

    function emit(intent: Intent): void {
      const events = mode.handle(intent);
      if (intent.type === INTENT_TYPES.applyPreset) {
        presetNote.textContent = ('activePreset' in mode ? mode.activePreset?.note : '') ?? '';
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

    function applyUi(ui: ModeUi): void {
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
      if (ui.timebar.maxScale) timebar.setMaxScale(ui.timebar.maxScale);
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
    narr.set(desc.narrate(session.model));
    if (hud) hud.update(mode.hud());
    applyEvents(mode.update(0)); // anuncio inicial del modo (p. ej. la pieza a nombrar)
    renderer.update(visualNow(), 0);

    const unframe = session.onFrame((simDt) => {
      const now = performance.now();
      const real = (now - lastReal) / 1000;
      lastReal = now;

      applyEvents(mode.update(simDt));
      renderer.update(visualNow(), simDt);
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
          narr.set(desc.narrate(session.model));
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
      destroy(): void {
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

  function unmount(): void {
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
    route(target): void {
      if (!target) {
        showHome();
        return;
      }
      let kind;
      let id: string | null;
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
          mount({ kind: 'lab', module: desc });
        } else {
          nav.go(null);
          showHome();
        }
      } else {
        const stageDef = getStage(id);
        const desc = stageDef ? modules.find((m) => m.id === stageDef.module) : null;
        if (stageDef && desc && isStageUnlocked(stageDef, save.get())) {
          mount({ kind: 'stage', module: desc, stage: stageDef, attempt: 0 });
        } else {
          nav.go(null);
          showHome();
        }
      }
    },
    unmount,
  };
}
