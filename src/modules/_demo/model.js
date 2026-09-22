// Módulo de prueba del shell: un estanque que se vacía por una válvula (Torricelli).
import { clamp } from '../../core/math.js';

export const DEFAULT_PARAMS = { valve: 0.5, inflow: false, inflowRate: 300 };
export const DEFAULT_FAULTS = { clog: 0, leak: false };

const AREA = 0.25; // m² de sección del estanque (sólo para la escala)
const K_OUT = 900; // L/h por √m con la válvula abierta del todo
const CAPACITY = 100; // L

export function createDemoModel(overrides = {}) {
  const params = { ...DEFAULT_PARAMS, ...overrides.params };
  const faults = { ...DEFAULT_FAULTS, ...overrides.faults };
  const state = {};
  const model = { params, faults, state, time: 0, step, reset, actions: {} };

  function initState() {
    Object.assign(state, { level: 80, qOut: 0, qIn: 0, qLeak: 0, flowState: 'idle' });
  }

  function step(dt) {
    const head = state.level / 1000 / AREA; // m de columna
    const open = clamp(params.valve, 0, 1) * (1 - 0.9 * clamp(faults.clog, 0, 1));
    state.qOut = state.level > 0 ? K_OUT * open * Math.sqrt(Math.max(0, head)) : 0;
    state.qLeak = faults.leak && state.level > 0 ? 60 : 0;
    state.qIn = params.inflow ? clamp(params.inflowRate, 0, 1000) : 0;
    state.level = clamp(state.level + ((state.qIn - state.qOut - state.qLeak) / 3600) * dt * 20, 0, CAPACITY);
    state.flowState = state.qOut > 1 ? 'flowing' : state.level <= 0 ? 'empty' : 'idle';
    model.time += dt;
  }

  function reset() {
    Object.assign(params, DEFAULT_PARAMS);
    Object.assign(faults, DEFAULT_FAULTS);
    model.time = 0;
    initState();
  }

  model.actions.refill = () => (state.level = CAPACITY);
  initState();
  return model;
}
