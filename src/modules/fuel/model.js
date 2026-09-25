// Sistema de combustible con retorno. Física en docs/modules/fuel.md §4 (orden de evaluación 1–11).
// Puro (§1), determinista (§3), unidades: bar relativos, L/h, V, A, s (§5).

import { clamp, expSmooth, wrap } from '../../core/math.ts';
import { createRng } from '../../core/rng.ts';

export const DEFAULT_PARAMS = {
  ignitionKey: 'off', // 'off' | 'on' | 'start' | 'run'
  rpm: 800,
  throttle: 0,
  batteryV: 12.6,
  fastConsumption: false,
};

export const DEFAULT_FAULTS = {
  strainerClog: 0,
  filterClog: 0,
  pumpWear: 0,
  relay: 'ok', // 'ok' | 'intermittent' | 'dead'
  regulator: 'ok', // 'ok' | 'stuckOpen' | 'stuckClosed'
  vacuumHoseOff: false,
  injectorLeak: 0,
  lineLeak: 0,
};

export const K = {
  Qmax0: 120, // L/h a 13.5 V, caudal libre
  Pmax0: 6.5, // bar de cierre a 13.5 V
  vNominal: 13.5,
  kStrainer0: 4e-6, // bar/(L/h)²
  kLine0: 3e-6,
  kFilter0: 1e-5,
  C: 0.005, // L/bar, compliancia de riel + mangueras
  kReg: 1000, // L/h por bar sobre el setpoint
  regSet: 3.0,
  regSetStuckOpen: 0.8,
  injFlow3bar: 12, // L/h por inyector abierto a 3 bar
  tankCapacity: 50,
  pickupLow: 1.0, // L bajo los cuales la bomba aspira aire
  primeTime: 2,
  crankRpm: 250,
  idleRpmMin: 600,
  alternatorV: 1.4,
  crankSagV: 2.0,
  startRatio: 0.6,
  startTime: 0.5,
  stallRatio: 0.4,
  stallTime: 0.3,
  leanRatio: 0.8, // λ ≈ 1.25: límite de falla por mezcla pobre (fuel.md §9b)
  richRatio: 1.35,
  injTau: 0.2,
  relayCutTime: 0.3,
  relayCutMeanInterval: 2,
};

const FIRING_OFFSETS = [0, 540, 180, 360]; // inyectores 1..4 con orden 1-3-4-2
const KINJ = K.injFlow3bar / Math.sqrt(3);

export function createFuelModel(overrides = {}) {
  // reset() vuelve a estos valores iniciales, overrides incluidos.
  const initialParams = { ...DEFAULT_PARAMS, ...overrides.params };
  const initialFaults = { ...DEFAULT_FAULTS, ...overrides.faults };
  const params = { ...initialParams };
  const faults = { ...initialFaults };
  const state = {};
  let rng;
  let prevKey;
  let goodMixTime;
  let badMixTime;
  let relayCut;
  let injAvgExpected;

  const model = { params, faults, state, time: 0, step, reset, actions: {} };

  function initState() {
    rng = createRng(overrides.seed ?? 12345);
    prevKey = 'off';
    goodMixTime = 0;
    badMixTime = 0;
    relayCut = 0;
    injAvgExpected = 0;
    Object.assign(state, {
      engineState: 'off',
      relayOn: false,
      primeTimer: 0,
      pumpV: 0,
      pumpCurrent: 0,
      qPump: 0,
      pPumpOut: 0,
      dpFilter: 0,
      pRail: 0,
      pMan: 0,
      pRef: 0,
      regOpen: 0,
      qReturn: 0,
      qInjTotal: 0,
      qInjAvg: 0,
      mixtureRatio: 0,
      injectors: [{ open: false }, { open: false }, { open: false }, { open: false }],
      qLeakInj: 0,
      qLeakLine: 0,
      tankLevel: overrides.tankLevel ?? 40,
      pickupAir: 0,
      crankAngle: 0,
      rpmEff: 0,
    });
  }

  function step(dt) {
    const s = state;
    const key = params.ignitionKey;

    // 1. Motor y relé
    if (key !== prevKey) {
      if (key === 'on' && prevKey === 'off') s.primeTimer = K.primeTime;
      if (key === 'off' || key === 'on') s.engineState = 'off';
      if (key === 'start' && s.engineState !== 'running' && s.engineState !== 'misfire') {
        s.engineState = 'cranking';
        goodMixTime = 0;
      }
      prevKey = key;
    }
    // Pasar directo a "Marcha" con el motor detenido gira la llave por "Arranque".
    if (key === 'run' && s.engineState === 'off') {
      s.engineState = 'cranking';
      goodMixTime = 0;
    }
    if (key === 'off') s.primeTimer = 0;
    s.primeTimer = Math.max(0, s.primeTimer - dt);

    const cranking = s.engineState === 'cranking';
    const running = s.engineState === 'running' || s.engineState === 'misfire';
    let relayCmd = s.primeTimer > 0 || cranking || running;
    if (key === 'off') relayCmd = false;

    if (faults.relay === 'dead') relayCmd = false;
    else if (faults.relay === 'intermittent' && relayCmd) {
      if (relayCut > 0) relayCut -= dt;
      else if (rng.chance(dt / K.relayCutMeanInterval)) relayCut = K.relayCutTime;
      if (relayCut > 0) relayCmd = false;
    } else relayCut = 0;
    s.relayOn = relayCmd;

    s.rpmEff = running ? clamp(params.rpm, K.idleRpmMin, 6500) : cranking ? K.crankRpm : 0;
    const turning = s.rpmEff > 0;

    // 2. Tensión de la bomba
    const v = clamp(params.batteryV, 0, 16) + (running ? K.alternatorV : 0) - (cranking ? K.crankSagV : 0);
    s.pumpV = s.relayOn ? v : 0;
    const vf = clamp(v / K.vNominal, 0, 1.1);

    // 3. Aire en la aspiración
    s.pickupAir = 1 - clamp(s.tankLevel / K.pickupLow, 0, 1);

    // 4. Caudal de la bomba (forma cerrada)
    const wear = clamp(faults.pumpWear, 0, 1);
    const Qm = K.Qmax0 * (1 - 0.7 * wear) * vf;
    const Pm = K.Pmax0 * (1 - 0.5 * wear) * vf;
    const kFilter = K.kFilter0 * (1 + 1000 * clamp(faults.filterClog, 0, 1));
    const kSum = K.kStrainer0 * (1 + 150 * clamp(faults.strainerClog, 0, 1)) + K.kLine0 + kFilter;
    let q = 0;
    if (s.relayOn && Pm > 0.01) {
      const c = Qm * (1 - s.pRail / Pm);
      if (c > 0) {
        const a = (Qm * kSum) / Pm;
        q = (-1 + Math.sqrt(1 + 4 * a * c)) / (2 * a);
      }
    }
    s.qPump = q * (1 - s.pickupAir);
    s.pPumpOut = s.relayOn ? s.pRail + kSum * s.qPump * s.qPump : s.pRail;
    s.dpFilter = kFilter * s.qPump * s.qPump;
    s.pumpCurrent = s.relayOn && Pm > 0.01 ? (1.5 + (5.5 * s.pPumpOut) / Pm) * vf : 0;

    // 5. Vacío del múltiple
    const thr = clamp(params.throttle, 0, 1);
    s.pMan = turning ? -0.65 + 0.65 * thr : 0;
    s.pRef = faults.vacuumHoseOff ? 0 : s.pMan;

    // 6. Regulador
    const set = faults.regulator === 'stuckOpen' ? K.regSetStuckOpen : K.regSet;
    s.qReturn = faults.regulator === 'stuckClosed' ? 0 : K.kReg * Math.max(0, s.pRail - (s.pRef + set));
    s.regOpen = clamp(s.qReturn / 100, 0, 1);

    // 7. Inyectores
    s.crankAngle = wrap(s.crankAngle + (s.rpmEff / 60) * 360 * dt, 720);
    const pwMs = 1.8 + 10.5 * thr + (cranking ? 3 : 0);
    const pwDeg = ((pwMs * s.rpmEff) / 60) * 360 / 1000;
    const dpInj = Math.max(0, s.pRail - s.pMan);
    const qOpen = KINJ * Math.sqrt(dpInj);
    const qOpenExpected = KINJ * Math.sqrt(K.regSet);
    let nOpen = 0;
    for (let i = 0; i < 4; i++) {
      const open = turning && wrap(s.crankAngle - FIRING_OFFSETS[i], 720) < pwDeg;
      s.injectors[i].open = open;
      if (open) nOpen++;
    }
    s.qInjTotal = nOpen * qOpen;
    s.qInjAvg = expSmooth(s.qInjAvg, s.qInjTotal, dt, K.injTau);
    injAvgExpected = expSmooth(injAvgExpected, nOpen * qOpenExpected, dt, K.injTau);
    s.mixtureRatio = injAvgExpected > 1e-3 ? s.qInjAvg / injAvgExpected : 0;

    // 8. Estado del motor según la mezcla
    if (cranking) {
      goodMixTime = s.mixtureRatio >= K.startRatio ? goodMixTime + dt : 0;
      if (goodMixTime >= K.startTime) {
        s.engineState = 'running';
        badMixTime = 0;
      }
    } else if (running) {
      badMixTime = s.mixtureRatio < K.stallRatio ? badMixTime + dt : 0;
      if (badMixTime >= K.stallTime) s.engineState = 'stalled';
      else if (s.mixtureRatio < K.leanRatio || s.mixtureRatio > K.richRatio) s.engineState = 'misfire';
      else s.engineState = 'running';
    }

    // 9. Fugas
    const sq = s.pRail > 0 ? Math.sqrt(s.pRail) : 0;
    s.qLeakInj = 0.6 * clamp(faults.injectorLeak, 0, 1) * sq;
    s.qLeakLine = 2.0 * clamp(faults.lineLeak, 0, 1) * sq;

    // 10. Riel
    const net = s.qPump - s.qInjTotal - s.qReturn - s.qLeakInj - s.qLeakLine;
    s.pRail = clamp(s.pRail + (net / 3600 / K.C) * dt, 0, 10);

    // 11. Estanque (el retorno vuelve al estanque: no cuenta)
    const burn = ((s.qInjTotal + s.qLeakInj + s.qLeakLine) / 3600) * dt * (params.fastConsumption ? 100 : 1);
    s.tankLevel = clamp(s.tankLevel - burn, 0, K.tankCapacity);

    model.time += dt;
  }

  function reset() {
    Object.assign(params, initialParams);
    Object.assign(faults, initialFaults);
    model.time = 0;
    initState();
  }

  model.actions.refill = () => (state.tankLevel = 45);
  model.actions.setTank = (liters) => (state.tankLevel = clamp(Number(liters) || 0, 0, K.tankCapacity));

  initState();
  return model;
}
