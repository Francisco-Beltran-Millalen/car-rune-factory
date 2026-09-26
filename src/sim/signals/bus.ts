// Bus de señales (§28, plan del vehículo §5). Puro (§1). El de laboratorio
// (A11) valida un solo dueño y sirve stubs ideales (§29); A15 escribe la
// versión del vehículo sobre el mismo contrato.

import { finite } from '../../core/math.ts';
import type { ParamRecord } from '../../core/types.ts';
import type { ControllerDef } from '../controllers/base.ts';

export interface SignalBus {
  /** Valor del paso anterior (o del mismo, para las señales `sameStep`). */
  get(id: string): number;
  /** Escribe una señal publicada; valida el dueño (§28). */
  set(owner: string, id: string, value: number): void;
  /** Lo escrito en el paso anterior pasa a ser lo que se lee. */
  commit(): void;
  snapshot(): Readonly<Record<string, number>>;
}

/** Stub con estado: el bus lo avanza en cada paso y `get` devuelve su valor. */
export interface StubState {
  step(dt: number, params: Readonly<ParamRecord>): void;
  get(): number;
}

export type StubSource = number | ((params: Readonly<ParamRecord>) => number) | StubState;

export interface LabBusOptions {
  owner: string;
  publishes: readonly string[];
  stubs: Readonly<Record<string, StubSource>>;
  /** Señales de fase: se leen del mismo paso (plan del vehículo §5.2). */
  sameStep?: readonly string[];
  /** Si es `true`, `get` de una señal desconocida lanza (tests). */
  strict?: boolean;
}

export interface LabBus extends SignalBus {
  bindParams(params: Readonly<ParamRecord>): void;
  /** Avanza los stubs con estado (el controlador `labBus` llama esto). */
  step(dt: number): void;
}

export function createLabBus(options: LabBusOptions): LabBus {
  const published = new Set(options.publishes);
  const sameStep = new Set(options.sameStep ?? []);
  const written: Record<string, number> = {};
  const settled: Record<string, number> = {};
  let params: Readonly<ParamRecord> = {};

  function stubValue(id: string): number {
    const source = options.stubs[id];
    if (source === undefined) return 0;
    if (typeof source === 'number') return source;
    return finite(typeof source === 'function' ? source(params) : source.get());
  }

  return {
    get(id: string): number {
      if (published.has(id)) {
        const value = sameStep.has(id) ? written[id] ?? settled[id] : settled[id];
        return value ?? 0;
      }
      if (id in options.stubs) return stubValue(id);
      if (options.strict) throw new Error(`Señal desconocida en el bus: ${id}`);
      return 0;
    },
    set(owner: string, id: string, value: number): void {
      if (owner !== options.owner) {
        throw new Error(`La señal '${id}' la escribe '${owner}', no '${options.owner}' (§28).`);
      }
      written[id] = finite(value);
    },
    commit(): void {
      Object.assign(settled, written);
    },
    snapshot(): Readonly<Record<string, number>> {
      return { ...settled, ...written };
    },
    bindParams(next: Readonly<ParamRecord>): void {
      params = next;
    },
    step(dt: number): void {
      const seen = new Set<StubState>();
      for (const source of Object.values(options.stubs)) {
        if (typeof source !== 'object' || seen.has(source)) continue;
        seen.add(source);
        source.step(dt, params);
      }
    },
  };
}

/** Controlador que pone el módulo primero: cierra el paso y avanza los stubs. */
export function createLabBusController(id: string, bus: LabBus): ControllerDef {
  return {
    id,
    update(ctx): void {
      bus.bindParams(ctx.params);
      bus.commit();
      bus.step(ctx.dt);
    },
  };
}
