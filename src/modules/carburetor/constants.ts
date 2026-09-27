// Constantes del carburador (A16, spec carburetor §5). Puro (§1).

export const K = {
  // Aire y venturi (§5.1, §5.2).
  kv: 4.45e-7,
  hBase: 0.0006,
  hLevelRef: 0.06,
  hLevelSpan: 0.02,
  bowlHighRef: 0.062,
  bowlFloodLevel: 0.099,
  vapMinTempC: 10,
  vapSpanTempC: 70,
  vapFloor: 0.45,
  vapSpan: 0.55,
  airMassMin: 0.5,

  // Transitorio y bomba de aceleración (§5.3).
  transientTau: 0.25,
  accelGain: 0.8,
  accelTau: 0.4,

  // Red de bencina (§5.4).
  tankCapacity: 50,
  tankDefault: 40,
  disp: 5e-4,
  pumpSlip: 30,
  pumpMax: 0.3,
  pumpWearQ: 0.8,
  pumpLeakK: 10,
  filterK: 2e-5,
  filterClogFactor: 2000,
  needleGOpen: 164,
  needleGLeak: 0,
  needleRef: 0.06,
  needleSpan: 0.008,
  needleSafeFloor: 0.08,
  bowlCapacity: 0.1,
  bowlNominal: 0.06,
  fuelDensity: 0.74,
  bowlDisponibleRef: 0.01,

  maxRpm: 6500,
} as const;
