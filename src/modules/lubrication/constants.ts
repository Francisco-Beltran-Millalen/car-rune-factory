// Constantes y variantes de la lubricación (A14, spec lubrication §5). Puro (§1).

export type LubricationVariant = 'gauge' | 'lamp';
export type OilGrade = '5W-30' | '10W-40' | '20W-50';

export interface LubricationVariantInfo {
  id: string;
  title: string;
  summary: string;
  order: number;
  hasGauge: boolean;
}

export const VARIANTS: Readonly<Record<LubricationVariant, LubricationVariantInfo>> = {
  gauge: {
    id: 'lubrication-gauge',
    title: 'Lubricación años 70 (manómetro)',
    summary:
      'Cárter húmedo, bomba de engranajes, válvula de alivio, filtro de cartucho y manómetro: la presión sigue a la viscosidad del aceite.',
    order: 8,
    hasGauge: true,
  },
  lamp: {
    id: 'lubrication-lamp',
    title: 'Lubricación años 2000 (testigo)',
    summary:
      'Cárter húmedo, bomba de engranajes, válvula de alivio, filtro enroscable con antirretorno y testigo de presión.',
    order: 9,
    hasGauge: false,
  },
};

export const GRADES: Readonly<Record<OilGrade, { nu100: number; beta: number }>> = {
  '5W-30': { nu100: 10, beta: 0.03 },
  '10W-40': { nu100: 14, beta: 0.031 },
  '20W-50': { nu100: 18, beta: 0.033 },
};

/** Viscosidad (cSt) del grado a temperatura T. Pura, la usa el controlador. */
export function viscosityOf(grade: OilGrade, tempC: number): number {
  const g = GRADES[grade];
  return g.nu100 * Math.exp(g.beta * (100 - tempC));
}

export const K = {
  sumpCapacity: 5,
  levelFull: 4,
  kPickup: 1e-8,
  pickupClogFactor: 300,
  disp: 6.67e-3,
  slip: 20,
  reliefSet: 4.5,
  reliefSetOpen: 0.8,
  kRelief: 10000,
  reliefSmooth: 0.02,
  kFilter: 7e-8,
  filterClogFactor: 1000,
  bypassSet: 1.0,
  cGallery: 0.002,
  gTotal: 260,
  shareMain: 0.45,
  shareRod: 0.35,
  shareCam: 0.2,
  kGasketLeak: 30,
  panDrip: 0.05,
  switchBar: 0.5,
  lampR: 60,
  vBusRun: 13.8,
  vBusOff: 12.6,
  gaugeTau: 0.3,
  damageRate: 0.02,
  damageSeized: 0.95,
  dryTime: 3,
  dryAfter: 60,
  airLevelRef: 2.0,
  lateralShift: 1.5,
  cavRef: -0.6,
  cavSpan: 0.3,
  cavTau: 0.05,
  wearRef: 14,
  maxRpm: 6500,
} as const;
