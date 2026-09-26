// Constantes del encendido (A12, spec ignition §5). Puro (§1).

export type IgnitionVariant = 'points' | 'cop';

export interface IgnitionVariantInfo {
  id: string;
  title: string;
  summary: string;
  order: number;
  variant: IgnitionVariant;
}

export const VARIANTS: Readonly<Record<IgnitionVariant, IgnitionVariantInfo>> = {
  points: {
    id: 'ignition-points',
    title: 'Encendido años 70 (platinos)',
    summary:
      'Bobina única con platinos y condensador, distribuidor con avance centrífugo y por vacío: la chispa nace cuando los contactos cortan la corriente.',
    order: 4,
    variant: 'points',
  },
  cop: {
    id: 'ignition-cop',
    title: 'Encendido años 2000 (COP)',
    summary:
      'Una bobina por cilindro, igniter y sensores de cigüeñal y leva: la ECU decide cuándo cargar y cuándo cortar.',
    order: 5,
    variant: 'cop',
  },
};

export const IG = {
  pointsPrimaryR: 1.5,
  pointsBallastR: 1.5,
  pointsL: 0.008,
  pointsDwellFactor: 0.556,
  copPrimaryR: 0.5,
  copL: 0.003,
  copCurrentLimit: 8,
  eta: 0.5,
  /** Capacidad parásita del secundario (F). */
  cs: 50e-12,
  vMaxKv: 35,
  /** Separación base de la bujía (mm) y cuánto la abre el desgaste. */
  gapBase: 0.7,
  gapWearSpan: 0.9,
  fouledGain: 0.85,
  rotorWornKv: 4,
  condenserOpenEta: 0.12,
  pittingGain: 0.05,
  pittingR: 1,
  pointsBase: 8,
  pointsGapAdvance: 10,
  centrifugalMax: 24,
  vacuumMax: 16,
  copBase: 10,
  copRpmAdvance: 20,
  copVacAdvance: 12,
  syncBaseRpm: 150,
  syncGapRpm: 350,
  correlationDeg: 6,
  correlationTime: 2,
  vacuumLeakKgH: 1.5,
  sparkTau: 0.2,
  arcPowerW: 20,
  /** Presión politrópica estimada en la chispa. */
  nCompression: 1.3,
  maxRpm: 6500,
} as const;

/** Desfases de los cilindros 1..4, orden 1-3-4-2. */
export const FIRING_OFFSETS = [0, 540, 180, 360] as const;
