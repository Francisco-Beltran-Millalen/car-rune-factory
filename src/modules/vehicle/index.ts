// `vehicleModule(def)` (A15, D-V1): arma el `ModuleDescriptor` del vehículo
// a partir de un `VehicleDef`, traduciendo controles/fallas/mediciones/
// piezas/relato de cada sistema con su prefijo (plan §4 paso 6, §9).
//
// Simplificaciones deliberadas de este primer corte (documentadas también
// en el CERRADO de A15, no bloquean la aceptación del plan):
// - El circuito de render es la unión de cada sistema **tal cual dibuja su
//   propio laboratorio** (con su propia batería, aunque en la física esa
//   batería esté excluida por no ser la proveedora del bus, §4 paso 3): no
//   se dibuja un riel compartido cruzando regiones (plan §9) todavía.
// - El sistema `mechanism` (4 tiempos) se dibuja como una caja simple
//   (`mechanismInset`), no el inset con su propia vista miniatura.
// - Los botones de acción (`refill`, `changeOil`…) y los presets no están
//   cableados: se sacan de la lista de controles para no dejar botones
//   rotos; los presets del vehículo quedan pendientes.
// - `ControlSpec.disabledWhen` no se traduce (nunca deshabilita en el
//   vehículo).

import './vehicle.css';
import { defineModule, type AnyModel, type ControlSpec, type FaultCatalogEntry, type FaultSpec, type Model, type ModuleDescriptor, type Narration, type ParamRecord, type PartInfo, type ReadoutSpec } from '../../core/types.ts';
import type { CircuitDef, CircuitLinkDef, CircuitPartDef, CircuitProbeDef } from '../../sim/circuit/types.ts';
import type { VehicleDef } from '../../sim/vehicle/types.ts';
import { translateCircuit } from '../../sim/circuit/translate.ts';
import { compileVehicle } from './compile.ts';
import { VEHICLE_70, VEHICLE_2000 } from './defs.ts';
import { mergePresentSchemes, scopePresentScheme } from './present.ts';
import { SYSTEM_REGISTRY } from './registry.ts';

const SHARED_PARAM_KEYS: readonly string[] = ['ignitionKey', 'throttle', 'rpm', 'vehicleSpeedKmh'];

function scopedRecord(all: Readonly<Record<string, unknown>>, prefix: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const withColon = `${prefix}:`;
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(withColon)) out[key.slice(withColon.length)] = value;
  }
  return out;
}

/**
 * El circuito de render es la unión de cada sistema **tal cual dibuja su
 * propio laboratorio** (`wiring.rawDef`, sin el filtro de física que excluye
 * la batería duplicada, §4 paso 3): visualmente cada sistema conserva su
 * batería, aunque en la física esté fundida con la del proveedor del bus.
 * Dibujar un riel compartido cruzando regiones queda pendiente (nota de
 * cabecera del archivo).
 */
function mergedCircuitOf(def: VehicleDef): CircuitDef {
  const parts: CircuitPartDef[] = [];
  const links: CircuitLinkDef[] = [];
  const probes: Record<string, CircuitProbeDef> = {};
  for (const sys of def.systems) {
    if (sys.kind === 'mechanism') {
      parts.push({ id: sys.id, type: 'visual', visual: 'mechanismInset', label: '4 tiempos (abrir laboratorio)', x: sys.at[0], y: sys.at[1] });
      continue;
    }
    const wiring = SYSTEM_REGISTRY[sys.circuit ?? sys.id];
    if (wiring?.kind !== 'circuit') continue;
    const translated = translateCircuit(wiring.rawDef, sys.at, sys.id);
    parts.push(...translated.parts);
    links.push(...translated.links);
    Object.assign(probes, translated.probes ?? {});
  }
  return {
    id: def.id,
    title: def.title,
    parts,
    links,
    probes,
  };
}

function scopedControls(specs: readonly ControlSpec[], prefix: string, seenShared: Set<string>): ControlSpec[] {
  const out: ControlSpec[] = [];
  for (const spec of specs) {
    if (spec.type === 'button') continue; // acciones no cableadas todavía
    if (spec.key === undefined) continue;
    const rest: ControlSpec = { ...spec };
    delete rest.disabledWhen; // nunca deshabilita en el vehículo (nota de cabecera)
    if (SHARED_PARAM_KEYS.includes(spec.key)) {
      if (seenShared.has(spec.key)) continue;
      seenShared.add(spec.key);
      out.push(rest);
      continue;
    }
    out.push({ ...rest, key: `${prefix}:${spec.key}` });
  }
  return out;
}

function scopedFaultSpecs(specs: readonly FaultSpec[], prefix: string): FaultSpec[] {
  return specs.map((f) => ({ ...f, key: `${prefix}:${f.key}` }));
}

function scopedFaultCatalog(entries: readonly FaultCatalogEntry[] | undefined, prefix: string): FaultCatalogEntry[] {
  return (entries ?? []).map((e) => ({
    ...e,
    id: `${prefix}:${e.id}`,
    modelKey: `${prefix}:${e.modelKey}`,
    part: `${prefix}:${e.part}`,
  }));
}

function scopedReadouts(specs: readonly ReadoutSpec[], prefix: string): ReadoutSpec[] {
  return specs.map((r) => ({
    ...r,
    id: `${prefix}:${r.id}`,
    // Frontera (§31): el estado real de este sistema es justo lo que su
    // `get` ya esperaba (mismo shape que en su laboratorio), sólo que acá
    // vive con el prefijo `sistema:` en el estado plano del vehículo.
    get: (state: Readonly<Record<string, unknown>>): number => r.get(scopedRecord(state, prefix)),
  }));
}

function scopedParts(parts: Readonly<Record<string, PartInfo>>, prefix: string): Record<string, PartInfo> {
  const out: Record<string, PartInfo> = {};
  for (const [id, info] of Object.entries(parts)) out[`${prefix}:${id}`] = info;
  return out;
}

export function vehicleModule(def: VehicleDef, order: number): ModuleDescriptor {
  // Instancia de referencia (una vez, al armar el descriptor): de acá salen
  // los `defaultParams`/`defaultFaults` planos y el circuito de render.
  const reference = compileVehicle(def);

  const controls: ControlSpec[] = [];
  const faultSpecs: FaultSpec[] = [];
  const faultCatalog: FaultCatalogEntry[] = [];
  const readouts: ReadoutSpec[] = [];
  const parts: Record<string, PartInfo> = {};
  const presentSchemes = [];
  const narrators: { id: string; narrate: (m: AnyModel) => Narration[] }[] = [];
  const seenShared = new Set<string>();

  for (const sys of reference.systems) {
    const desc = sys.wiring.moduleDescriptor;
    controls.push(...scopedControls(desc.controls, sys.id, seenShared));
    faultSpecs.push(...scopedFaultSpecs(desc.faults, sys.id));
    faultCatalog.push(...scopedFaultCatalog(desc.faultCatalog, sys.id));
    readouts.push(...scopedReadouts(desc.readouts, sys.id));
    Object.assign(parts, scopedParts(desc.parts, sys.id));
    // La caja del mecanismo (el motor de 4 tiempos) también es clickeable (§10).
    if (sys.wiring.kind === 'mechanism') {
      parts[sys.id] = {
        name: desc.title,
        what: desc.summary,
        why: 'Es el motor: los demás sistemas leen de él las rpm, la carga y la fase.',
        how: `En el vehículo se ve como una caja; el detalle está en su laboratorio (#/lab/${desc.id}).`,
        failures: [],
      };
    }
    if (desc.present) presentSchemes.push(scopePresentScheme(desc.present, sys.id));
    narrators.push({ id: sys.id, narrate: (m) => desc.narrate(m) });
  }

  const circuit = mergedCircuitOf(def);
  const present = mergePresentSchemes(presentSchemes);

  return defineModule({
    id: def.id,
    title: def.title,
    summary: def.summary,
    order,
    viewBox: def.viewBox,
    createModel: () => compileVehicle(def).model,
    circuit,
    present,
    defaultParams: reference.model.params,
    defaultFaults: reference.model.faults,
    controls,
    faults: faultSpecs,
    faultCatalog,
    readouts,
    parts,
    narrate: (model: Model<ParamRecord, ParamRecord, Record<string, unknown>>): Narration[] => {
      const out: Narration[] = [];
      for (const { id, narrate } of narrators) {
        // Frontera (§31): cada `narrate` de sistema ya conoce su propia
        // forma de `params`/`faults`/`state` (la de su laboratorio); acá
        // sólo se le pasa sin el prefijo `sistema:` del vehículo.
        const shim: AnyModel = {
          params: scopedRecord(model.params, id) as ParamRecord,
          faults: scopedRecord(model.faults, id) as ParamRecord,
          state: scopedRecord(model.state, id),
          actions: {},
          time: model.time,
          step(): void {
            // A propósito: el relato sólo lee, nunca avanza el reloj.
          },
          reset(): void {
            // A propósito: idem.
          },
        };
        out.push(...narrate(shim));
      }
      return out;
    },
  });
}

export const vehicle70 = vehicleModule(VEHICLE_70, 20);
export const vehicle2000 = vehicleModule(VEHICLE_2000, 21);
