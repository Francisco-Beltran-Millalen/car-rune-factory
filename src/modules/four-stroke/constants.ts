// Constantes y variantes del ciclo de 4 tiempos (A11, spec four-stroke §5).
// Puro (§1). Las constantes geométricas viven en `sim/engine/geometry.ts`.

/** Las dos variantes del arquetipo (spec §1). */
export type FourStrokeVariant = 'ohv' | 'dohc';
export type DriveType = 'chain' | 'belt';

export interface VariantInfo {
  id: string;
  title: string;
  summary: string;
  order: number;
  /** Tensor hidráulico (depende de la presión de aceite) o de resorte. */
  hydraulicTensioner: boolean;
  /** Tren de válvulas OHV: varillas y balancines, falla `rocker.lash`. */
  hasRocker: boolean;
  /** Admite la correa como `drive` (falla `timingBelt.worn`). */
  hasBelt: boolean;
}

export const VARIANTS: Readonly<Record<FourStrokeVariant, VariantInfo>> = {
  ohv: {
    id: 'four-stroke-ohv',
    title: 'Motor años 70 (OHV)',
    summary: 'Ciclo de 4 tiempos con varillas y balancines: admisión, compresión, expansión y escape, y la cadena que manda la leva.',
    order: 2,
    hydraulicTensioner: false,
    hasRocker: true,
    hasBelt: false,
  },
  dohc: {
    id: 'four-stroke-dohc',
    title: 'Motor años 2000 (DOHC)',
    summary: 'Ciclo de 4 tiempos con dos árboles de levas y tensor hidráulico: admisión, compresión, expansión y escape.',
    order: 3,
    hydraulicTensioner: true,
    hasRocker: false,
    hasBelt: true,
  },
};

export const K = {
  /** Calor por ciclo a fondo, por cilindro (J). */
  qWot: 1250,
  nRun: 1.3,
  nCrank: 1.2,
  /** Por debajo de estas rpm el ciclo pierde calor (arrastre). */
  crankRpm: 400,
  escapeBar: 1.1,
  /** Fricción del cigüeñal: Tf = friction0 + frictionRpm·rpm (N·m). */
  friction0: 12,
  frictionRpm: 0.002,
  /** 1 diente de la leva = 720/42 = 17,14° de cigüeñal. */
  toothDeg: 720 / 42,
  chainStretchDeg: 6,
  beltWearDeg: 3,
  keywayDeg: 8,
  keywayBase: 0.3,
  keywayLoad: 0.7,
  keywayWobble: 0.2,
  /** Daño del chavetero por perno flojo: ×1000, se dice en la narración. */
  boltDamageRate: 0.02,
  shearSlipRate: 20,
  hydraulicSlack: 0.6,
  oilFull: 1,
  rattleSlack: 0.3,
  jumpSlack: 0.8,
  jumpAccel: 1500,
  jumpChance: 0.5,
  jitterDeg: 2,
  knockPlay: 2,
  beltBreakWear: 0.9,
  beltBreakLoad: 0.5,
  beltBreakTime: 5,
  testRpm: 250,
  testTime: 3,
  compressionEvery: 0.1,
  ringLeak: 8,
  burntValveLeak: 20,
  minPressure: 0.05,
  maxPressure: 150,
  maxRpm: 6500,
} as const;

/** Desfase de cada cilindro (1..4) en la fase de la leva, orden 1-3-4-2. */
export const FIRING_OFFSETS = [0, 540, 180, 360] as const;
