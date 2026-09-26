// Reglas de "¿Qué está pasando?" de la lubricación (spec lubrication §9).

import type { Narration } from '../../core/types.ts';
import type { LubricationModel } from './circuit.ts';

/** Crea el narrador (con su propio estado interno, uno por montaje). */
export function createNarrator(): (m: LubricationModel) => Narration[] {
  let lastDamage = 0;
  return function narrate(m): Narration[] {
    const s = m.state;
    const p = m.params;
    const out: Narration[] = [];

    if (s.seized) {
      out.push({ level: 'bad', text: 'El motor se agarrotó.' });
    }
    if (s.lampOn && p.ignitionKey === 'run') {
      out.push({ level: 'bad', text: 'Se prendió el testigo de aceite: la presión bajó de 0,5 bar.' });
    }
    if (s.pumpAir > 0.1) {
      out.push({ level: 'bad', text: 'La bomba aspira aire (poco aceite o rejilla tapada).' });
    }
    if (s.bearingDamage > lastDamage + 1e-6) {
      out.push({
        level: 'bad',
        text: 'Sin presión los cojinetes se están dañando (acelerado ×1000).',
      });
    }
    lastDamage = s.bearingDamage;

    if (s.bypassOpen) {
      out.push({
        level: 'warn',
        text: 'El filtro está tapado: la válvula de bypass deja pasar aceite sin filtrar.',
      });
    }
    if (s.knock > 0.3) {
      out.push({ level: 'warn', text: 'Golpeteo de bielas: los cojinetes tienen mucha holgura.' });
    }
    if (s.startupDry > 0) {
      out.push({
        level: 'warn',
        text: 'Al partir no hay presión por unos segundos: el filtro se vació (válvula antirretorno).',
      });
    }

    if (p.ignitionKey === 'on' && s.lampOn) {
      out.push({
        level: 'info',
        text: 'Testigo prendido con el motor detenido: es normal (prueba de ampolleta).',
      });
    }
    if (p.oilTempC < 40 && s.qRelief > 1 && p.ignitionKey === 'run') {
      out.push({
        level: 'info',
        text: 'El aceite frío es espeso: la presión sube al tope y la válvula de alivio devuelve el sobrante.',
      });
    }
    return out;
  };
}
