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
  /** Vuelve al valor de arranque (lo llama `LabBus.reset`). */
  reset?(): void;
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
  /** Olvida lo escrito y reinicia los stubs con estado: el ⟲ del modelo (§3). */
  reset(): void;
}

function resetStubs(stubs: Readonly<Record<string, StubSource>>): void {
  for (const source of Object.values(stubs)) {
    if (typeof source === 'object') source.reset?.();
  }
}

function clearRecord(record: Record<string, number>): void {
  for (const key of Object.keys(record)) Reflect.deleteProperty(record, key);
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
    reset(): void {
      clearRecord(written);
      clearRecord(settled);
      resetStubs(options.stubs);
    },
  };
}

/** Una señal del bus del vehículo (A15): su dueño (`null` = stub, §29) y si
 *  es de fase (`same-step`, plan §5.2). Subconjunto de `VehicleSignalDef`
 *  (`sim/vehicle/types.ts`) para no acoplar este archivo a esa capa. */
export interface VehicleBusSignal {
  id: string;
  owner: string | null;
  latency?: 'step' | 'same-step';
}

export interface VehicleBusOptions {
  signals: readonly VehicleBusSignal[];
  /** Stubs ideales (§29) para las señales con `owner: null`. */
  stubs: Readonly<Record<string, StubSource>>;
  strict?: boolean;
}

/**
 * Bus del vehículo (plan §5, D-V4): mismo contrato `LabBus` que usa cada
 * controlador de sistema sin cambios, pero con **varios dueños validados**
 * (uno por señal, según `signals`) en vez de uno solo para todo el bus. Una
 * señal sin dueño declarado cae al stub ideal, igual que el laboratorio.
 */
export function createVehicleBus(options: VehicleBusOptions): LabBus {
  const owners = new Map<string, string>();
  const sameStep = new Set<string>();
  for (const signal of options.signals) {
    if (signal.owner !== null) owners.set(signal.id, signal.owner);
    if (signal.latency === 'same-step') sameStep.add(signal.id);
  }
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
      if (owners.has(id)) {
        const value = sameStep.has(id) ? written[id] ?? settled[id] : settled[id];
        return value ?? 0;
      }
      if (id in options.stubs) return stubValue(id);
      if (options.strict) throw new Error(`Señal desconocida en el bus del vehículo: ${id}`);
      return 0;
    },
    set(owner: string, id: string, value: number): void {
      const expected = owners.get(id);
      if (expected === undefined) {
        throw new Error(`La señal '${id}' no tiene dueño declarado en este vehículo (§28).`);
      }
      if (owner !== expected) {
        throw new Error(`La señal '${id}' la escribe '${expected}', no '${owner}' (§28).`);
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
    reset(): void {
      clearRecord(written);
      clearRecord(settled);
      resetStubs(options.stubs);
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
