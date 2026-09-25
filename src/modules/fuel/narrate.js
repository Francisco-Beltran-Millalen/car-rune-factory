// Reglas de "¿Qué está pasando?" (docs/modules/fuel.md §8). Sólo leen el modelo (§2).

import { fmt } from '../../core/format.ts';

/** Memoria mínima para detectar que la presión residual cae (motor apagado). */
function createPressureWatch() {
  let lastT = null;
  let lastP = 0;
  let rate = 0;
  return (m) => {
    const t = m.time;
    if (lastT !== null && t > lastT + 0.2) {
      rate = (m.state.pRail - lastP) / (t - lastT);
      lastT = t;
      lastP = m.state.pRail;
    } else if (lastT === null || t < lastT) {
      lastT = t;
      lastP = m.state.pRail;
      rate = 0;
    }
    return rate;
  };
}

/** Crea el narrador (con su propio estado interno, uno por montaje). */
export function createNarrator() {
  const watch = createPressureWatch();

  return function narrate(m) {
    const s = m.state;
    const p = m.params;
    const f = m.faults;
    const out = [];
    const running = s.engineState === 'running' || s.engineState === 'misfire';
    const dropRate = watch(m);

    if (s.engineState === 'stalled') out.push({ level: 'bad', text: 'El motor se detuvo por falta de combustible. Vuelve a "Arranque".' });
    if (s.pickupAir > 0) out.push({ level: 'bad', text: 'La bomba aspira aire: el estanque está casi vacío.' });
    if (f.regulator === 'stuckClosed' && s.relayOn)
      out.push({ level: 'bad', text: 'Sin retorno: la presión sube hasta el límite de la bomba (mezcla muy rica).' });
    if (s.engineState === 'cranking' && m.time > 0 && s.pRail < 1.2 && s.relayOn)
      out.push({ level: 'bad', text: 'El motor gira pero no parte: no hay presión suficiente en el riel.' });
    if (s.engineState === 'cranking' && !s.relayOn && f.relay === 'dead')
      out.push({ level: 'bad', text: 'El relé no cierra: la bomba no recibe corriente y el motor no puede partir.' });

    if (s.dpFilter > 0.5)
      out.push({ level: 'warn', text: `El filtro está restringiendo: pierde ${fmt(s.dpFilter, 1)} bar. Se nota más al acelerar.` });
    if (f.vacuumHoseOff && running && p.throttle < 0.3)
      out.push({ level: 'warn', text: 'Sin referencia de vacío, la presión en ralentí sube ~0,6 bar (mezcla rica).' });
    if (s.engineState === 'misfire' && s.mixtureRatio < 1)
      out.push({ level: 'warn', text: `Mezcla pobre (${Math.round(s.mixtureRatio * 100)} %): el motor falla y tironea.` });
    if (s.mixtureRatio > 1.35 && running)
      out.push({ level: 'warn', text: 'Mezcla rica: entra más combustible del que la ECU calculó.' });
    if (!running && s.engineState !== 'cranking' && s.pRail > 0.3 && dropRate < -0.02)
      out.push({ level: 'warn', text: 'La presión residual no se mantiene: hay una fuga (inyector o línea).' });
    if (f.relay === 'intermittent' && running && !s.relayOn)
      out.push({ level: 'warn', text: 'El relé cortó un instante: la bomba se detuvo y la presión cae.' });
    if (s.qLeakLine > 0.1) out.push({ level: 'warn', text: 'Fuga en la línea: se pierde bencina antes del filtro (¡peligro de incendio!).' });

    if (s.primeTimer > 0 && s.relayOn)
      out.push({ level: 'info', text: 'Contacto: la ECU activa la bomba 2 s para presurizar el riel.' });
    const dpRef = s.pRail - s.pRef;
    if (running && dpRef > 2.7 && dpRef < 3.3)
      out.push({ level: 'info', text: 'Presión estable: el regulador devuelve el sobrante al estanque.' });
    if (running && s.qReturn > 0 && p.throttle > 0.7)
      out.push({ level: 'info', text: 'A fondo los inyectores consumen más y vuelve menos bencina por el retorno.' });
    if (s.engineState === 'off' && p.ignitionKey === 'off')
      out.push({ level: 'info', text: 'Gira la llave a "Contacto" para ver el cebado de la bomba.' });
    if (s.engineState === 'off' && p.ignitionKey === 'on' && s.primeTimer <= 0)
      out.push({ level: 'info', text: 'Cebado terminado: la válvula check mantiene la presión residual. Pasa a "Arranque".' });

    return out;
  };
}
