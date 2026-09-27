// Reglas de "¿Qué está pasando?" del carburador (spec carburetor §9).

import type { Narration } from '../../core/types.ts';
import type { CarburetorModel } from './circuit.ts';

/** Crea el narrador (con su propio estado interno, uno por montaje). */
export function createNarrator(): (m: CarburetorModel) => Narration[] {
  return function narrate(m): Narration[] {
    const s = m.state;
    const p = m.params;
    const f = m.faults;
    const out: Narration[] = [];

    if (s.flooding) {
      out.push({ level: 'bad', text: 'La cuba rebalsa: la bencina cae al múltiple y el motor se ahoga.' });
    }
    if (s.bowlLevel < 0.02) {
      out.push({ level: 'bad', text: 'La cuba se está vaciando: no alcanza a entrar bencina.' });
    }
    if (s.mixture < 0.7 && s.accelBoost < 0.05 && p.throttle > 0.05) {
      out.push({ level: 'warn', text: 'Tironeo al pisar: falta el chorro de la bomba de aceleración.' });
    }
    if (f.pumpDiaphragm) {
      out.push({
        level: 'warn',
        text: 'El diafragma de la bomba mecánica está roto: bombea la mitad y pierde bencina (en el auto va al cárter).',
      });
    }
    if (p.engineTempC < 40 && s.chokeEff < 0.2) {
      out.push({ level: 'warn', text: 'Con el motor frío la bencina no se evapora bien: la mezcla queda pobre. Tira el choke.' });
    }
    if (p.engineTempC > 60 && s.chokeEff > 0.5) {
      out.push({ level: 'warn', text: 'Choke tirado con el motor caliente: mezcla muy rica (humo negro).' });
    }

    if (p.throttle < 0.15 && s.mainFraction < 0.2) {
      out.push({
        level: 'info',
        text: 'En ralentí la mariposa está casi cerrada: la bencina sale por el orificio de ralentí, debajo de ella, aspirada por el vacío del múltiple.',
      });
    }
    if (s.mainFraction > 0.8) {
      out.push({
        level: 'info',
        text: 'Con más aire el venturi hace depresión y aspira la bencina por el surtidor principal.',
      });
    }
    return out;
  };
}
