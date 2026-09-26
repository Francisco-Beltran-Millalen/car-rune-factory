// Reglas de "¿Qué está pasando?" de la refrigeración (spec cooling §9).

import type { Narration } from '../../core/types.ts';
import type { CoolingModel } from './circuit.ts';

/** Crea el narrador (con su propio estado interno, uno por montaje). */
export function createNarrator(): (m: CoolingModel) => Narration[] {
  let lastOpen = 0;
  return function narrate(m): Narration[] {
    const s = m.state;
    const f = m.faults;
    const out: Narration[] = [];

    if (s.boiling) {
      out.push({
        level: 'bad',
        text: '¡Hierve el refrigerante! Se forma vapor y la bomba empieza a mover aire.',
      });
    }
    if (s.level < 5.5) {
      out.push({ level: 'bad', text: 'Falta refrigerante: la bomba aspira aire.' });
    }
    if (s.engineTemp > 105) {
      out.push({ level: 'warn', text: 'El motor se está recalentando.' });
    }
    if (f.thermostat === 'stuckOpen' && s.engineTemp < 80) {
      out.push({
        level: 'warn',
        text: 'El motor no llega a temperatura: el termostato está abierto y el radiador lo enfría todo el tiempo.',
      });
    }
    if (f.capFailed && s.engineTemp > 100) {
      out.push({
        level: 'warn',
        text: 'La tapa no sostiene presión: hierve a 107 °C en vez de 129.',
      });
    }
    if (Math.abs(s.gaugeTemp - s.engineTemp) > 15) {
      out.push({
        level: 'warn',
        text: 'El reloj no marca lo que pasa en el motor: el sensor falla.',
      });
    }
    if (s.thermostatOpen > 0 && lastOpen === 0) {
      out.push({
        level: 'info',
        text: 'El termostato empieza a abrir: el refrigerante ya pasa por el radiador.',
      });
    }
    lastOpen = s.thermostatOpen;
    if (s.fanOn && !f.fanDead) {
      out.push({ level: 'info', text: 'Se prendió el ventilador.' });
    }
    if (s.thermostatOpen === 0 && s.engineTemp > 70) {
      out.push({ level: 'info', text: 'Todo el refrigerante circula por el bypass: el motor calienta rápido.' });
    }
    return out;
  };
}
