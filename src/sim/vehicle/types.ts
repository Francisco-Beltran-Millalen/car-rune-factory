// Contratos del vehículo (A15, plan del vehículo §3): puros, sin conocer
// ningún módulo concreto — eso lo arma `src/modules/vehicle/` (§11: un
// sistema nunca importa a otro; el vehículo es la única excepción, y vive
// fuera de `sim/`). Capa `sim` (§19).

import type { Fluid } from '../solver/types.ts';

export interface VehicleSystemDef {
  /** 'fuel' | 'ignition' | 'four-stroke' | 'cooling' | 'lubrication'… */
  id: string;
  /** Red del solver o mecanismo sin nodos (D-V10, four-stroke). */
  kind: 'circuit' | 'mechanism';
  /** Id del circuito/variante registrado (p. ej. 'ignition-points'); requerido si `kind: 'circuit'`. */
  circuit?: string;
  /** Región del diagrama del vehículo (esquina superior izquierda). */
  at: readonly [number, number];
}

export interface VehicleBusDef {
  /** '12v' | 'chassis'… */
  id: string;
  domain: 'electric' | 'hydraulic';
  /** Obligatorio si `domain: 'hydraulic'` (§30). */
  fluid?: Fluid;
  /** Sistema que aporta la fuente; `null` = sin fuente (chassis). */
  provider: string | null;
}

export interface VehicleSignalDef {
  /** 'engine.rpm' (§28). */
  id: string;
  /** Sistema dueño; `null` = stub ideal (§29). */
  owner: string | null;
  unit: string;
  label: string;
  /** 'same-step' sólo para señales de fase (D-V4, §5.2). Por defecto 'step'. */
  latency?: 'step' | 'same-step';
}

export interface VehicleDef {
  /** 'vehicle-70' (genérico, no un auto real). */
  id: string;
  title: string;
  summary: string;
  viewBox: readonly [number, number, number, number];
  systems: readonly VehicleSystemDef[];
  buses: readonly VehicleBusDef[];
  signals: readonly VehicleSignalDef[];
}
