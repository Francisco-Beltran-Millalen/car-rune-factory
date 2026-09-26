// Reglas de "¿Qué está pasando?" del encendido (spec ignition §9).

import type { Narration } from '../../core/types.ts';
import type { IgnitionModel } from './circuit.ts';

/** Crea el narrador (uno por montaje). */
export function createNarrator(variant: 'points' | 'cop'): (m: IgnitionModel) => Narration[] {
  const points = variant === 'points';
  return function narrate(m): Narration[] {
    const s = m.state;
    const p = m.params;
    const f = m.faults;
    const out: Narration[] = [];

    if (!points && !s.sync) {
      out.push({
        level: 'bad',
        text: 'La ECU no ve el sensor de cigüeñal: no hay chispa (ni inyección).',
      });
    }
    if (points && !s.sparkOk && p.ignitionKey === 'run' && f.ballastOpen) {
      out.push({
        level: 'bad',
        text: 'Con la llave en marcha no llega corriente a la bobina: el balasto está cortado. En arranque sí, porque se puentea.',
      });
    }
    if (points && f.condenserShorted) {
      out.push({
        level: 'bad',
        text: 'El condensador está en corto: los platinos no cortan la corriente y no hay chispa.',
      });
    }

    if (points && f.condenserOpen) {
      out.push({
        level: 'warn',
        text: 'Sin condensador los platinos hacen arco: la chispa es débil y los contactos se queman.',
      });
    }
    if (s.sparkRate < 0.9 && p.rpm > 4000) {
      out.push({
        level: 'warn',
        text: `A alta carga la bujía pide ${s.vReq.toFixed(1).replace('.', ',')} kV y la bobina da ${s.vAvail.toFixed(1).replace('.', ',')} kV: falla en alta.`,
      });
    }
    if (points && Math.abs(p.camOffset) > 5) {
      out.push({
        level: 'warn',
        text: `La chispa viene ${Math.abs(p.camOffset)}° ${p.camOffset > 0 ? 'atrasada' : 'adelantada'}: el distribuidor gira con la leva y la leva está fuera de punto.`,
      });
    }
    if (!points && s.codes.includes('P0016')) {
      out.push({
        level: 'warn',
        text: 'La ECU ve que la leva no coincide con el cigüeñal (P0016): revisa la distribución.',
      });
    }
    if (points && f.vacuumDiaphragm) {
      out.push({
        level: 'warn',
        text: 'El diafragma del avance por vacío está roto: no adelanta en crucero y entra aire falso al múltiple.',
      });
    }

    if (!points && f.camSensorDead && s.sync) {
      out.push({
        level: 'info',
        text: 'Sin sensor de leva la ECU enciende en chispa perdida: anda, pero deja el código P0340.',
      });
    }

    return out;
  };
}
