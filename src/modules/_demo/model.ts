// Módulo de prueba del shell: un estanque que se vacía por una válvula (Torricelli).
import { clamp } from '../../core/math.ts';
import type { Model, ModelActions } from '../../core/types.ts';

export type DemoParams = { valve: number; inflow: boolean; inflowRate: number };
export type DemoFaults = { clog: number; leak: boolean };
export type DemoState = {
  level: number;
  qOut: number;
  qIn: number;
  qLeak: number;
  flowState: 'idle' | 'flowing' | 'empty';
};
export type DemoModel = Model<DemoParams, DemoFaults, DemoState>;

export interface DemoOverrides {
  params?: Partial<DemoParams>;
  faults?: Partial<DemoFaults>;
}

export const DEFAULT_PARAMS: Readonly<DemoParams> = { valve: 0.5, inflow: false, inflowRate: 300 };
export const DEFAULT_FAULTS: Readonly<DemoFaults> = { clog: 0, leak: false };

const AREA = 0.25; // m² de sección del estanque (sólo para la escala)
const K_OUT = 900; // L/h por √m con la válvula abierta del todo
const CAPACITY = 100; // L

function initialState(): DemoState {
  return { level: 80, qOut: 0, qIn: 0, qLeak: 0, flowState: 'idle' };
}

export function createDemoModel(overrides: DemoOverrides = {}): DemoModel {
  const initialParams: DemoParams = { ...DEFAULT_PARAMS, ...overrides.params };
  const initialFaults: DemoFaults = { ...DEFAULT_FAULTS, ...overrides.faults };
  const params: DemoParams = { ...initialParams };
  const faults: DemoFaults = { ...initialFaults };
  const state: DemoState = initialState();
  let simTime = 0;

  const actions: ModelActions = {
    refill: (): void => {
      state.level = CAPACITY;
    },
  };

  const model: DemoModel = {
    params,
    faults,
    state,
    actions,
    get time(): number {
      return simTime;
    },
    step,
    reset,
  };

  function initState(): void {
    Object.assign(state, initialState());
  }

  function step(dt: number): void {
    const head = state.level / 1000 / AREA; // m de columna
    const open = clamp(params.valve, 0, 1) * (1 - 0.9 * clamp(faults.clog, 0, 1));
    state.qOut = state.level > 0 ? K_OUT * open * Math.sqrt(Math.max(0, head)) : 0;
    state.qLeak = faults.leak && state.level > 0 ? 60 : 0;
    state.qIn = params.inflow ? clamp(params.inflowRate, 0, 1000) : 0;
    state.level = clamp(state.level + ((state.qIn - state.qOut - state.qLeak) / 3600) * dt * 20, 0, CAPACITY);
    state.flowState = state.qOut > 1 ? 'flowing' : state.level <= 0 ? 'empty' : 'idle';
    simTime += dt;
  }

  function reset(): void {
    Object.assign(params, DEFAULT_PARAMS);
    Object.assign(faults, DEFAULT_FAULTS);
    simTime = 0;
    initState();
  }

  initState();
  return model;
}
