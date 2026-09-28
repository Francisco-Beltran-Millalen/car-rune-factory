// Puente de `fuel` con el bus del vehículo (A15, plan del vehículo §4.8 y
// §8). `fuel` es de A6, anterior al bus (§29 con un objeto `FuelSignals`
// propio, no `LabBus`): estas tres piezas lo conectan sin tocar
// `modules/fuel/controllers.ts` (`ecuFuel` se reusa tal cual).
//
// Ocupan, en la lista de controladores de `fuel` (`engineCore`, `ecuFuel`,
// `alternator`, `fuelSupply`, en ese orden), los mismos lugares:
// - `engineCore` → `createFuelBridgeIn`: en vez del motor de A6, copia del
//   bus (dueño real `engineCore`, hoisted aparte) al objeto `FuelSignals`
//   que sigue esperando `ecuFuel`. Corre primero, como pide el orden real.
// - `fuelSupply` → `createFuelSupplyWithBridgeOut`: además de su trabajo de
//   siempre, publica `fuel.mixture` en el bus, corta los inyectores sin
//   `ecu.sync` ("sin sincronía la ECU no inyecta", §4.8) y pisa el relé
//   (`ecuFuel` lo deja siempre cerrado, spec fuel §9b; en el vehículo cierra
//   de verdad con `relayOn`, con la rampa suave del `switch`, plan §8).
// - `alternator` → `createVehicleAlternatorBridge`: en `vehicle-2000`,
//   `fuel` es el proveedor del bus `12v` (plan §8): su batería **no** se
//   compuerta por `relayOn` (eso apagaría el bus entero), sólo el `alternator`.

import { clamp } from '../../core/math.ts';
import type { ParamValue } from '../../core/types.ts';
import type { ControllerDef } from '../../sim/controllers/index.ts';
import type { LabBus } from '../../sim/signals/bus.ts';
import { ENGINE_STATE_NAME } from '../../sim/controllers/engineCore.ts';
import type { FuelSignals } from '../fuel/controllers.ts';
import { K } from '../fuel/reference-model.ts';

export { FUEL_DEF } from '../fuel/circuit.ts';

function num(value: ParamValue | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Copia bus → `FuelSignals` (§25: con un paso de retraso, como toda señal
 *  salvo la fase). `pRef` se simplifica a `pMan` (sin la falla de manguera de
 *  vacío propia de `fuel` en el vehículo, marginal: sólo cambia una lectura
 *  de `qReturn`, no la física — la aguja del regulador ya la corta
 *  `engineCore` directo sobre el elemento `vacuumHose`). */
export function createFuelBridgeIn(id: string, bus: LabBus, signals: FuelSignals): ControllerDef {
  return {
    id,
    update(): void {
      signals.engineState = ENGINE_STATE_NAME[bus.get('engine.state')] ?? 'off';
      signals.rpmEff = bus.get('engine.rpm');
      signals.crankAngle = bus.get('engine.crankAngle');
      signals.pMan = bus.get('intake.map');
      signals.pRef = signals.pMan;
    },
  };
}

/** Reemplaza a `createAlternator` (fuel/controllers.ts) sólo en el vehículo:
 *  misma tensión, sin el corte por `relayOn` (plan §8). */
export function createVehicleAlternatorBridge(
  id: string,
  _params: Readonly<Record<string, ParamValue>>,
  signals: FuelSignals,
): ControllerDef {
  return {
    id,
    update(ctx): void {
      const batteryV = clamp(num(ctx.params['batteryV'], K.vNominal), 0, 16);
      const running = signals.engineState === 'running' || signals.engineState === 'misfire';
      const cranking = signals.engineState === 'cranking';
      const v = batteryV + (running ? K.alternatorV : 0) - (cranking ? K.crankSagV : 0);
      const battery = ctx.elements['battery'];
      if (battery) battery.control['v'] = v;
    },
  };
}

/** `fuelSupply` (fuel/controllers.ts) + el puente de salida (§4.8, §8). */
export function createFuelSupplyWithBridgeOut(
  id: string,
  _params: Readonly<Record<string, ParamValue>>,
  bus: LabBus,
  signals: FuelSignals,
): ControllerDef {
  return {
    id,
    probes: ['pickupAir'],
    update(ctx): void {
      const pump = ctx.elements['pump'];
      if (pump) pump.control['air'] = clamp(ctx.read('pickupAir'), 0, 1);

      bus.set('fuel', 'fuel.mixture', signals.mixture);

      if (bus.get('ecu.sync') < 1) {
        for (let i = 1; i <= 4; i++) {
          const injector = ctx.elements[`injector${i}`];
          if (injector) injector.control['open'] = false;
        }
      }
      const relay = ctx.elements['relay'];
      if (relay) relay.control['closed'] = signals.relayOn;
    },
  };
}
