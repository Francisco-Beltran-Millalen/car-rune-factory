// Catálogo de drawers por tipo visual (§23, P23 D7): geometría pura + dibujo
// (plan V1). Un tipo sin entrada no se dibuja (nudos, piezas sólo del modelo).

import type { DrawerEntry } from '../types.ts';
import {
  engineJacketDrawer,
  engineJacketGeometry,
  thermostatDrawer,
  thermostatGeometry,
  waterPumpDrawer,
  waterPumpGeometry,
} from './cooling/engine.ts';
import {
  expansionTankDrawer,
  expansionTankGeometry,
  fanDrawer,
  fanGeometry,
  heaterCoreDrawer,
  heaterCoreGeometry,
  radiatorDrawer,
  radiatorGeometry,
  tempGaugeDrawer,
  tempGaugeGeometry,
} from './cooling/loop.ts';
import {
  batteryDrawer,
  batteryGeometry,
  ecuDrawer,
  ecuGeometry,
  keyDrawer,
  relayDrawer,
  switchBoxGeometry,
  wiresDrawer,
  wiresGeometry,
} from './electrical.ts';
import { compressionBarsDrawer, compressionBarsGeometry } from './engine/bars.ts';
import { cylinderSectionDrawer, cylinderSectionGeometry } from './engine/cylinder.ts';
import { pvDiagramDrawer, pvDiagramGeometry } from './engine/pv.ts';
import { timingDriveDrawer, timingDriveGeometry } from './engine/timing.ts';
import { filterDrawer, filterGeometry, railDrawer, railGeometry } from './fuel-path.ts';
import {
  checkValveDrawer,
  checkValveGeometry,
  pumpDrawer,
  pumpGeometry,
  strainerDrawer,
  strainerGeometry,
  tankDrawer,
  tankGeometry,
} from './hydraulic.ts';
import {
  ballastDrawer,
  ballastGeometry,
  coilDrawer,
  coilGeometry,
  sparkPlugDrawer,
  sparkPlugGeometry,
} from './ignition/coil.ts';
import { distributorDrawer, distributorGeometry } from './ignition/distributor.ts';
import { scopeDrawer, scopeGeometry } from './ignition/scope.ts';
import { toothWheelDrawer, toothWheelGeometry } from './ignition/toothWheel.ts';
import { injectorDrawer, injectorGeometry } from './injector.ts';
import {
  manifoldDrawer,
  manifoldGeometry,
  regulatorDrawer,
  regulatorGeometry,
  vacuumHoseDrawer,
  vacuumHoseGeometry,
} from './intake.ts';
import {
  feedLineDrawer,
  hosePointDrawer,
  labelGeometry,
  linePointGeometry,
  returnLineDrawer,
} from './labels.ts';
import {
  bearingDrawer,
  bearingGeometry,
  galleryDrawer,
  galleryGeometry,
  gearPumpDrawer,
  gearPumpGeometry,
  oilFilterDrawer,
  oilFilterGeometry,
  oilGaugeDrawer,
  oilGaugeGeometry,
  oilPressureSwitchDrawer,
  oilPressureSwitchGeometry,
  reliefValveDrawer,
  reliefValveGeometry,
  sumpDrawer,
  sumpGeometry,
  warningLampDrawer,
  warningLampGeometry,
} from './lubrication/oil.ts';

export const DRAWERS: Readonly<Record<string, DrawerEntry>> = {
  battery: { geometry: batteryGeometry, draw: batteryDrawer },
  key: { geometry: switchBoxGeometry, draw: keyDrawer },
  relay: { geometry: switchBoxGeometry, draw: relayDrawer },
  ecu: { geometry: ecuGeometry, draw: ecuDrawer },
  wires: { geometry: wiresGeometry, draw: wiresDrawer },
  tank: { geometry: tankGeometry, draw: tankDrawer },
  strainer: { geometry: strainerGeometry, draw: strainerDrawer },
  pump: { geometry: pumpGeometry, draw: pumpDrawer },
  checkValve: { geometry: checkValveGeometry, draw: checkValveDrawer },
  feedLine: { geometry: linePointGeometry, draw: feedLineDrawer },
  hosePoint: { geometry: linePointGeometry, draw: hosePointDrawer },
  filter: { geometry: filterGeometry, draw: filterDrawer },
  rail: { geometry: railGeometry, draw: railDrawer },
  injector: { geometry: injectorGeometry, draw: injectorDrawer },
  manifold: { geometry: manifoldGeometry, draw: manifoldDrawer },
  regulator: { geometry: regulatorGeometry, draw: regulatorDrawer },
  vacuumHose: { geometry: vacuumHoseGeometry, draw: vacuumHoseDrawer },
  returnLine: { geometry: labelGeometry, draw: returnLineDrawer },
  cylinderSection: { geometry: cylinderSectionGeometry, draw: cylinderSectionDrawer },
  timingDrive: { geometry: timingDriveGeometry, draw: timingDriveDrawer },
  pvDiagram: { geometry: pvDiagramGeometry, draw: pvDiagramDrawer },
  compressionBars: { geometry: compressionBarsGeometry, draw: compressionBarsDrawer },
  ballast: { geometry: ballastGeometry, draw: ballastDrawer },
  coil: { geometry: coilGeometry, draw: coilDrawer },
  coilCop: { geometry: coilGeometry, draw: coilDrawer },
  sparkPlug: { geometry: sparkPlugGeometry, draw: sparkPlugDrawer },
  distributor: { geometry: distributorGeometry, draw: distributorDrawer },
  toothWheel: { geometry: toothWheelGeometry, draw: toothWheelDrawer },
  scope: { geometry: scopeGeometry, draw: scopeDrawer },
  engineJacket: { geometry: engineJacketGeometry, draw: engineJacketDrawer },
  waterPump: { geometry: waterPumpGeometry, draw: waterPumpDrawer },
  thermostat: { geometry: thermostatGeometry, draw: thermostatDrawer },
  radiator: { geometry: radiatorGeometry, draw: radiatorDrawer },
  fan: { geometry: fanGeometry, draw: fanDrawer },
  expansionTank: { geometry: expansionTankGeometry, draw: expansionTankDrawer },
  heaterCore: { geometry: heaterCoreGeometry, draw: heaterCoreDrawer },
  tempGauge: { geometry: tempGaugeGeometry, draw: tempGaugeDrawer },
  sump: { geometry: sumpGeometry, draw: sumpDrawer },
  gearPump: { geometry: gearPumpGeometry, draw: gearPumpDrawer },
  reliefValve: { geometry: reliefValveGeometry, draw: reliefValveDrawer },
  oilFilter: { geometry: oilFilterGeometry, draw: oilFilterDrawer },
  gallery: { geometry: galleryGeometry, draw: galleryDrawer },
  bearing: { geometry: bearingGeometry, draw: bearingDrawer },
  warningLamp: { geometry: warningLampGeometry, draw: warningLampDrawer },
  oilPressureSwitch: { geometry: oilPressureSwitchGeometry, draw: oilPressureSwitchDrawer },
  oilGauge: { geometry: oilGaugeGeometry, draw: oilGaugeDrawer },
};
