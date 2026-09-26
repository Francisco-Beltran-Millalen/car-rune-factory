// Catálogo §26 de fallas del ciclo de 4 tiempos (spec §4), por variante.
// `repair` y `symptoms` son datos de juego y los agrega A3, sin cambiar ids.

import type { FaultCatalogEntry } from '../../core/types.ts';
import { VARIANTS, type FourStrokeVariant } from './constants.ts';

export function fourStrokeFaults(variant: FourStrokeVariant): readonly FaultCatalogEntry[] {
  const list: FaultCatalogEntry[] = [];
  for (let i = 1; i <= 4; i++) {
    list.push(
      {
        id: `cyl${i}.ringWear`,
        modelKey: `ringWear${i}`,
        part: `cyl${i}`,
        kind: 'severity',
        healthy: 0,
        visibility: 'never',
        label: `Anillos gastados (cilindro ${i})`,
      },
      {
        id: `cyl${i}.burntValve`,
        modelKey: `burntValve${i}`,
        part: `cyl${i}`,
        kind: 'severity',
        healthy: 0,
        visibility: 'inspect',
        label: `Válvula quemada (cilindro ${i})`,
      },
    );
  }
  list.push(
    {
      id: 'crankBolt.loose',
      modelKey: 'crankBoltLoose',
      part: 'crankBolt',
      kind: 'toggle',
      healthy: false,
      visibility: 'inspect',
      label: 'Perno del cigüeñal flojo',
    },
    {
      id: 'crankKey.keywayWorn',
      modelKey: 'keywayWorn',
      part: 'crankKey',
      kind: 'severity',
      healthy: 0,
      visibility: 'inspect',
      label: 'Chavetero ovalado',
    },
    {
      id: 'crankKey.sheared',
      modelKey: 'keySheared',
      part: 'crankKey',
      kind: 'toggle',
      healthy: false,
      visibility: 'always',
      label: 'Chaveta cortada',
    },
    {
      id: 'tensioner.weak',
      modelKey: 'tensionerWeak',
      part: 'tensioner',
      kind: 'severity',
      healthy: 0,
      visibility: 'inspect',
      label: 'Tensor flojo',
    },
    {
      id: 'chainGuide.broken',
      modelKey: 'guideBroken',
      part: 'chainGuide',
      kind: 'toggle',
      healthy: false,
      visibility: 'inspect',
      label: 'Guía de la cadena rota',
    },
    {
      id: 'timingChain.stretched',
      modelKey: 'chainStretch',
      part: 'timingChain',
      kind: 'severity',
      healthy: 0,
      visibility: 'inspect',
      label: 'Cadena estirada',
    },
    {
      id: 'timingChain.skippedTeeth',
      modelKey: 'skippedTeeth',
      part: 'timingChain',
      kind: 'enum',
      healthy: 0,
      visibility: 'always',
      label: 'Dientes saltados',
    },
  );
  if (VARIANTS[variant].hasRocker) {
    list.push({
      id: 'rocker.lash',
      modelKey: 'valveLash',
      part: 'rocker',
      kind: 'severity',
      healthy: 0,
      visibility: 'never',
      label: 'Juego de taqués',
    });
  }
  if (VARIANTS[variant].hasBelt) {
    list.push({
      id: 'timingBelt.worn',
      modelKey: 'beltWear',
      part: 'timingBelt',
      kind: 'severity',
      healthy: 0,
      visibility: 'inspect',
      label: 'Correa gastada',
    });
  }
  return list;
}
