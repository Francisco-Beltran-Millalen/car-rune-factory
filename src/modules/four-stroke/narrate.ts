// Reglas de "¿Qué está pasando?" del ciclo de 4 tiempos (spec §9). Sólo leen
// el modelo (§2); máx. 3 mensajes los recorta la barra de narración.

import type { Narration } from '../../core/types.ts';
import type { FourStrokeModel } from './circuit.ts';

const STROKE_TEXT: Record<string, string> = {
  admisión: 'Admisión: el pistón baja y aspira mezcla.',
  compresión: 'Compresión: las válvulas cerradas y el pistón sube.',
  expansión: 'Expansión: la chispa quema la mezcla y empuja el pistón.',
  escape: 'Escape: el pistón sube y barre los gases quemados.',
};

/** Crea el narrador (con su propio estado interno, uno por montaje). */
export function createNarrator(): (m: FourStrokeModel) => Narration[] {
  let lastStroke = '';

  return function narrate(m): Narration[] {
    const s = m.state;
    const p = m.params;
    const f = m.faults;
    const out: Narration[] = [];
    const turning = p.rpm > 0;
    const slow = p.mode === 'manual' || p.rpm < 300;

    const bent = s.bentValve.findIndex(Boolean);
    if (bent >= 0 || s.valveHit > 0) {
      const n = bent >= 0 ? bent + 1 : 0;
      out.push({
        level: 'bad',
        text: n > 0 ? `¡Las válvulas chocaron con el pistón en el cilindro ${n}! Ese cilindro se quedó sin compresión.` : '¡Las válvulas chocaron con el pistón!',
      });
    }
    if (s.keyShearedState || f.keySheared) {
      out.push({ level: 'bad', text: 'La chaveta se cortó: el piñón resbala y la leva se queda atrás.' });
    }

    if (s.slack > 0.3) {
      out.push({
        level: 'warn',
        text: 'La cadena está floja: golpetea (sobre todo al partir, antes de que suba la presión de aceite).',
      });
    }
    if (f.guideBroken) {
      out.push({ level: 'warn', text: 'La guía de la cadena está rota: quedan trozos de plástico en el cárter.' });
    }
    if (s.keywayPlay > 2) {
      out.push({
        level: 'warn',
        text: 'El piñón tiene juego sobre el cigüeñal: el chavetero está ovalado. Se escucha un golpeteo y el punto varía con la carga.',
      });
    }
    if (Math.abs(s.camOffset) > 3) {
      out.push({
        level: 'warn',
        text: `La leva va ${Math.abs(s.camOffset).toFixed(1).replace('.', ',')}° ${s.camOffset > 0 ? 'atrasada' : 'adelantada'} respecto del cigüeñal: la distribución está fuera de punto.`,
      });
    }
    if (f.crankBoltLoose) {
      out.push({
        level: 'warn',
        text: 'El perno del cigüeñal está flojo: el piñón trabaja suelto y gasta el chavetero (acelerado ×1000).',
      });
    }
    const low = s.testing ? -1 : s.compression.findIndex((v) => v > 0 && v < 9);
    if (low >= 0) {
      out.push({ level: 'warn', text: `El cilindro ${low + 1} comprime poco: anillos o válvula.` });
    }

    if (!p.spark && turning) {
      out.push({
        level: 'info',
        text: 'Sin chispa: se comprime y se expande sin combustión; el trabajo neto es casi cero.',
      });
    }
    if (slow && s.stroke !== lastStroke) {
      lastStroke = s.stroke;
      out.push({ level: 'info', text: STROKE_TEXT[s.stroke] ?? '' });
    }

    return out;
  };
}
