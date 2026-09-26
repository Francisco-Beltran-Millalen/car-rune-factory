// Catálogo de drawers por tipo visual (§23, P23 D7). Un tipo sin drawer no se
// dibuja (nodos `tee`, piezas sólo topológicas).

import type { DrawerFactory } from '../types.ts';
import { batteryDrawer, ecuDrawer, keyDrawer, relayDrawer, wiresDrawer } from './electrical.ts';
import { compressionBarsDrawer } from './engine/bars.ts';
import { cylinderSectionDrawer } from './engine/cylinder.ts';
import { pvDiagramDrawer } from './engine/pv.ts';
import { timingDriveDrawer } from './engine/timing.ts';
import { checkValveDrawer, pumpDrawer, strainerDrawer, tankDrawer } from './hydraulic.ts';
import { ballastDrawer, coilDrawer, sparkPlugDrawer } from './ignition/coil.ts';
import { distributorDrawer } from './ignition/distributor.ts';
import { scopeDrawer } from './ignition/scope.ts';
import { toothWheelDrawer } from './ignition/toothWheel.ts';
import { filterDrawer, railDrawer } from './fuel-path.ts';
import { injectorDrawer } from './injector.ts';
import { manifoldDrawer, regulatorDrawer, vacuumHoseDrawer } from './intake.ts';
import { feedLineDrawer, returnLineDrawer } from './labels.ts';

export const DRAWERS: Readonly<Record<string, DrawerFactory>> = {
  battery: batteryDrawer,
  key: keyDrawer,
  relay: relayDrawer,
  ecu: ecuDrawer,
  wires: wiresDrawer,
  tank: tankDrawer,
  strainer: strainerDrawer,
  pump: pumpDrawer,
  checkValve: checkValveDrawer,
  feedLine: feedLineDrawer,
  filter: filterDrawer,
  rail: railDrawer,
  injector: injectorDrawer,
  manifold: manifoldDrawer,
  regulator: regulatorDrawer,
  vacuumHose: vacuumHoseDrawer,
  returnLine: returnLineDrawer,
  cylinderSection: cylinderSectionDrawer,
  timingDrive: timingDriveDrawer,
  pvDiagram: pvDiagramDrawer,
  compressionBars: compressionBarsDrawer,
  ballast: ballastDrawer,
  coil: coilDrawer,
  coilCop: coilDrawer,
  sparkPlug: sparkPlugDrawer,
  distributor: distributorDrawer,
  toothWheel: toothWheelDrawer,
  scope: scopeDrawer,
};
