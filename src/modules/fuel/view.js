// Vista SVG del sistema de combustible (docs/modules/fuel.md §7). Sólo lee model.state (§2, §9).

import './fuel.css';
import { el, group, pipe, label, gaugeSvg, roundedPathD } from '../../core/svg.ts';
import { createFlow } from '../../core/particles.ts';
import { clamp, wrap, expSmooth } from '../../core/math.ts';

const PX_PER_LH = 4.6; // escala visual de este módulo (fuel.md §7)
const INJ_X = [760, 860, 960, 1060];
const INJ_OFFSETS = [0, 540, 180, 360]; // igual que model.js: orden 1-3-4-2
const KEY_LABEL = { off: 'Apagado', on: 'Contacto', start: 'Arranque', run: 'Marcha' };
const KEY_ANGLE = { off: -45, on: 0, start: 45, run: 20 };
const ENGINE_LABEL = { off: 'Motor detenido', cranking: 'Arrancando…', running: 'En marcha', misfire: 'Falla (mezcla)', stalled: 'Se detuvo' };

const TANK = { x: 60, y: 430, w: 320, h: 230 };
const RAIL_Y = 190;

/** Opacidad del fluido en una tubería según su presión (bar). */
const pressureOpacity = (p) => (0.18 + 0.62 * clamp(p / 4, 0, 1)).toFixed(2);

/** ¿El ángulo `offset` quedó entre prev y cur (avance `delta`)? */
const crossed = (prev, delta, offset) => delta > 0 && wrap(offset - prev, 720) < delta;

function springPoints(x, yTop, yBottom, coils = 6, amp = 9) {
  const pts = [[x, yTop]];
  const step = (yBottom - yTop) / (coils * 2);
  for (let i = 1; i < coils * 2; i++) pts.push([x + (i % 2 ? amp : -amp), yTop + i * step]);
  pts.push([x, yBottom]);
  return pts.map((p) => p.join(',')).join(' ');
}

export function createFuelView({ svg, model }) {
  const root = group(svg, { class: 'fuel' });
  const pipesL = group(root, { class: 'pipes' });
  const partsBehind = group(root);
  const flowL = group(root, { class: 'particles' });
  const partsL = group(root, { class: 'parts' });
  const fxL = group(root, { class: 'fx' });

  // ---------- Bloque eléctrico ----------
  const wireMain = pipe(pipesL, [[120, 70], [150, 70]], { width: 3, className: 'fluid-electric', part: 'battery' });
  const wireKey = pipe(pipesL, [[230, 70], [260, 70]], { width: 3, className: 'fluid-electric', part: 'key' });
  const wirePump = pipe(pipesL, [[300, 100], [300, 150], [140, 150], [140, 500], [200, 500]], {
    width: 3,
    className: 'fluid-electric',
    part: 'relay',
  });
  const wireEcu = pipe(pipesL, [[340, 70], [400, 70]], { width: 2, className: 'fluid-signal', part: 'ecu' });

  const battery = group(partsL, { part: 'battery' });
  el('rect', { x: 40, y: 40, width: 80, height: 60, rx: 6, class: 'part-body' }, battery);
  el('rect', { x: 55, y: 32, width: 12, height: 8, class: 'part-body' }, battery);
  el('rect', { x: 93, y: 32, width: 12, height: 8, class: 'part-body' }, battery);
  const battText = label(battery, 80, 76, '12,6 V', { anchor: 'middle', className: 'lbl lbl-mono' });
  label(battery, 80, 118, 'Batería', { anchor: 'middle', className: 'lbl-small part-label' });

  const key = group(partsL, { part: 'key' });
  el('rect', { x: 150, y: 40, width: 80, height: 60, rx: 30, class: 'part-body' }, key);
  const keyBlade = el('line', { x1: 190, y1: 70, x2: 190, y2: 48, class: 'key-blade' }, key);
  const keyText = label(key, 190, 118, 'Apagado', { anchor: 'middle', className: 'lbl-small' });

  const relay = group(partsL, { part: 'relay' });
  el('rect', { x: 260, y: 40, width: 80, height: 60, rx: 6, class: 'part-body' }, relay);
  el('circle', { cx: 280, cy: 80, r: 3, class: 'contact' }, relay);
  el('circle', { cx: 320, cy: 80, r: 3, class: 'contact' }, relay);
  const relayArm = el('line', { x1: 280, y1: 80, x2: 320, y2: 80, class: 'relay-arm' }, relay);
  label(relay, 300, 60, 'Relé', { anchor: 'middle', className: 'lbl-small part-label' });

  const ecu = group(partsL, { part: 'ecu' });
  el('rect', { x: 400, y: 40, width: 120, height: 60, rx: 6, class: 'part-body ecu-body' }, ecu);
  label(ecu, 460, 67, 'ECU', { anchor: 'middle', className: 'lbl part-label' });
  const ecuText = label(ecu, 460, 88, '', { anchor: 'middle', className: 'lbl-small lbl-mono' });

  // Señales ECU → inyectores (arnés: una pieza propia, distinta de cada inyector)
  const injWires = INJ_X.map((x) =>
    el('path', { d: roundedPathD([[520, 70], [x + 26, 70], [x + 26, 222], [x + 12, 222]], 6), class: 'signal-wire', part: 'injectorWires' }, pipesL),
  );

  // ---------- Estanque, bomba, colador ----------
  const tank = group(partsBehind, { part: 'tank' });
  el('rect', { x: TANK.x, y: TANK.y, width: TANK.w, height: TANK.h, rx: 14, class: 'part-body tank-body' }, tank);
  const liquid = el('rect', { x: TANK.x + 6, y: TANK.y, width: TANK.w - 12, height: 0, rx: 8, class: 'liquid fluid-fuel' }, tank);
  const surface = el('path', { class: 'liquid-surface' }, tank);
  label(tank, TANK.x + TANK.w - 12, TANK.y + 22, 'Estanque', { anchor: 'end', className: 'lbl part-label' });
  const tankText = label(tank, TANK.x + TANK.w - 12, TANK.y + 42, '', { anchor: 'end', className: 'lbl-small lbl-mono' });

  const suction = pipe(pipesL, [[220, 632], [220, 455]], { width: 10, className: 'fluid-fuel' });
  const pump = group(partsL, { part: 'pump' });
  el('rect', { x: 196, y: 478, width: 48, height: 136, rx: 10, class: 'part-body pump-body' }, pump);
  const rotor = group(pump);
  el('circle', { cx: 220, cy: 560, r: 15, class: 'rotor' }, rotor);
  el('line', { x1: 207, y1: 560, x2: 233, y2: 560, class: 'rotor-vane' }, rotor);
  el('line', { x1: 220, y1: 547, x2: 220, y2: 573, class: 'rotor-vane' }, rotor);
  el('text', { x: 220, y: 510, 'text-anchor': 'middle', class: 'lbl-small', text: 'M' }, pump);
  label(partsL, 252, 600, 'Bomba', { className: 'lbl-small part-label' });

  const strainer = group(partsL, { part: 'strainer' });
  el('rect', { x: 188, y: 616, width: 64, height: 22, rx: 4, class: 'part-body strainer-body' }, strainer);
  label(partsL, 258, 632, 'Colador', { className: 'lbl-small part-label' });

  const check = group(partsL, { part: 'checkValve' });
  el('circle', { cx: 220, cy: 466, r: 10, class: 'part-body' }, check);
  const checkBall = el('path', { d: 'M 213 470 L 227 470 L 220 460 Z', class: 'check-flap' }, check);
  label(partsL, 234, 462, 'Check', { className: 'lbl-small part-label' });

  // ---------- Línea de alimentación, filtro, riel ----------
  const feedA = pipe(pipesL, [[220, 455], [220, 330], [520, 330]], { width: 10, part: 'feedLine' });
  const feedB = pipe(pipesL, [[600, 330], [650, 330], [650, RAIL_Y], [700, RAIL_Y]], { width: 10, part: 'feedLine' });
  label(partsL, 300, 318, 'Alimentación →', { className: 'lbl-small part-label' });

  const filter = group(partsL, { part: 'filter' });
  el('rect', { x: 520, y: 308, width: 80, height: 44, rx: 12, class: 'part-body filter-body' }, filter);
  for (let x = 532; x < 596; x += 8) el('line', { x1: x, y1: 314, x2: x, y2: 346, class: 'filter-pleat' }, filter);
  const filterDirt = el('rect', { x: 522, y: 310, width: 0, height: 40, rx: 10, class: 'filter-dirt' }, filter);
  el('line', { x1: 540, y1: 364, x2: 584, y2: 364, class: 'flow-arrow', 'marker-end': 'url(#arrow)' }, filter);
  label(filter, 560, 385, 'Filtro', { anchor: 'middle', className: 'lbl-small part-label' });

  const rail = pipe(pipesL, [[700, RAIL_Y], [1130, RAIL_Y]], { width: 16, part: 'rail' });
  label(partsL, 710, RAIL_Y - 16, 'Riel', { className: 'lbl-small part-label' });
  // Manómetro en T sobre el riel
  pipe(pipesL, [[675, RAIL_Y], [675, 158]], { width: 4, part: 'rail' });
  const gauge = gaugeSvg(partsL, { cx: 675, cy: 118, r: 40, min: 0, max: 8, green: [2.2, 3.8], unit: 'bar', ticks: 4, part: 'rail' });

  // ---------- Inyectores y múltiple ----------
  const manifold = group(partsBehind, { part: 'manifold' });
  el('rect', { x: 690, y: 278, width: 440, height: 86, rx: 10, class: 'part-body manifold-body' }, manifold);
  label(manifold, 700, 356, 'Múltiple de admisión', { className: 'lbl-small part-label' });
  const engineTag = group(partsL, { class: 'engine-tag' });
  const engineTagBg = el('rect', { x: 960, y: 336, width: 160, height: 22, rx: 11, class: 'tag tag-off' }, engineTag);
  const engineTagText = label(engineTag, 1040, 351, '', { anchor: 'middle', className: 'tag-text' });

  const injectors = INJ_X.map((x, i) => {
    const g = group(partsL, { part: `injector${i + 1}` });
    el('rect', { x: x - 12, y: RAIL_Y + 12, width: 24, height: 54, rx: 5, class: 'part-body' }, g);
    el('path', { d: `M ${x - 7} ${RAIL_Y + 66} L ${x + 7} ${RAIL_Y + 66} L ${x} ${RAIL_Y + 80} Z`, class: 'part-body' }, g);
    const needle = el('line', { x1: x, y1: RAIL_Y + 20, x2: x, y2: RAIL_Y + 72, class: 'needle' }, g);
    label(g, x, RAIL_Y + 44, String(i + 1), { anchor: 'middle', className: 'lbl-small inj-num' });
    const spray = el('path', { d: `M ${x} ${RAIL_Y + 80} L ${x - 22} ${RAIL_Y + 140} Q ${x} ${RAIL_Y + 150} ${x + 22} ${RAIL_Y + 140} Z`, class: 'spray', opacity: 0 }, fxL);
    return { needle, spray, intensity: 0 };
  });

  // ---------- Regulador, vacío, retorno ----------
  const regulator = group(partsL, { part: 'regulator' });
  el('rect', { x: 1130, y: 150, width: 64, height: 92, rx: 12, class: 'part-body' }, regulator);
  const diaphragm = el('line', { x1: 1134, y1: 196, x2: 1190, y2: 196, class: 'diaphragm' }, regulator);
  const spring = el('polyline', { points: springPoints(1162, 200, 238), class: 'spring' }, regulator);
  label(regulator, 1162, 142, 'Regulador', { anchor: 'middle', className: 'lbl-small part-label' });

  const vacuumOn = pipe(pipesL, [[1120, 300], [1162, 300], [1162, 244]], { width: 5, className: 'fluid-vacuum', part: 'vacuumHose' });
  const vacuumOff = group(pipesL, { part: 'vacuumHose' });
  pipe(vacuumOff, [[1162, 244], [1162, 262], [1176, 276]], { width: 5, className: 'fluid-vacuum' });
  el('text', { x: 1182, y: 292, class: 'lbl-small warn-text', text: '¡suelta!' }, vacuumOff);

  const ret = pipe(pipesL, [[1194, 170], [1218, 170], [1218, 395], [340, 395], [340, 470]], { width: 8, part: 'returnLine' });
  label(partsL, 760, 385, '← Retorno al estanque', { className: 'lbl-small part-label' });

  // ---------- Fugas ----------
  const leakLineDrops = [0, 1, 2].map(() => el('circle', { r: 3, class: 'drop', opacity: 0 }, fxL));
  const leakInjDrops = [0, 1].map(() => el('circle', { r: 2.5, class: 'drop', opacity: 0 }, fxL));

  // ---------- Partículas ----------
  const flows = {
    elecMain: createFlow({ path: wireMain.path, layer: flowL, spacing: 10, radius: 2, className: 'p-electric' }),
    elecKey: createFlow({ path: wireKey.path, layer: flowL, spacing: 10, radius: 2, className: 'p-electric' }),
    elecPump: createFlow({ path: wirePump.path, layer: flowL, spacing: 12, radius: 2, className: 'p-electric' }),
    suction: createFlow({ path: suction.path, layer: flowL }),
    feedA: createFlow({ path: feedA.path, layer: flowL }),
    feedB: createFlow({ path: feedB.path, layer: flowL }),
    rail: createFlow({ path: rail.path, layer: flowL, spacing: 16, radius: 3.5 }),
    ret: createFlow({ path: ret.path, layer: flowL, spacing: 16 }),
  };
  void wireEcu;

  // ---------- Estado de la animación ----------
  let rotorAngle = 0;
  let prevCrank = null;
  let wave = 0;
  let dripT = 0;
  let lastSpringKey = '';
  let lastKey = '';

  function setFlow(f, lh, { air = 0 } = {}) {
    f.setSpeed(lh * PX_PER_LH);
    f.setDensity(lh > 0.3 ? 1 : 0);
    f.setAir(air);
  }

  function update(dt) {
    const s = model.state;
    const p = model.params;
    const f = model.faults;

    // Eléctrico
    const v = s.pumpV || p.batteryV;
    battText.textContent = `${v.toFixed(1).replace('.', ',')} V`;
    if (p.ignitionKey !== lastKey) {
      lastKey = p.ignitionKey;
      keyText.textContent = KEY_LABEL[p.ignitionKey] || p.ignitionKey;
      keyBlade.setAttribute('transform', `rotate(${KEY_ANGLE[p.ignitionKey] ?? 0} 190 70)`);
    }
    relayArm.setAttribute('transform', s.relayOn ? '' : 'rotate(-28 280 80)');
    const keyLive = p.ignitionKey !== 'off';
    for (const fl of [flows.elecMain, flows.elecKey]) {
      fl.setSpeed(keyLive ? 60 : 0);
      fl.setDensity(keyLive ? 1 : 0);
    }
    flows.elecPump.setSpeed(s.pumpCurrent * 18);
    flows.elecPump.setDensity(s.relayOn ? 1 : 0);
    ecuText.textContent = s.rpmEff > 0 ? `${Math.round(s.rpmEff)} rpm` : '';

    // Estanque
    const lvl = clamp(s.tankLevel / 50, 0, 1);
    const hgt = lvl * (TANK.h - 12);
    const top = TANK.y + TANK.h - 6 - hgt;
    liquid.setAttribute('y', top.toFixed(1));
    liquid.setAttribute('height', hgt.toFixed(1));
    wave += dt * 2.5;
    const a = hgt > 2 ? 2 : 0;
    let d = `M ${TANK.x + 6} ${top}`;
    for (let x = TANK.x + 6; x <= TANK.x + TANK.w - 6; x += 20) d += ` L ${x} ${(top + Math.sin(x / 25 + wave) * a).toFixed(1)}`;
    surface.setAttribute('d', d);
    tankText.textContent = `${s.tankLevel.toFixed(1).replace('.', ',')} L`;

    // Bomba y check
    rotorAngle = (rotorAngle + s.qPump * dt * 25) % 360;
    rotor.setAttribute('transform', `rotate(${rotorAngle.toFixed(1)} 220 560)`);
    checkBall.setAttribute('transform', s.qPump > 0.5 ? 'translate(0 -4)' : '');

    // Caudales
    setFlow(flows.suction, s.qPump, { air: s.pickupAir });
    setFlow(flows.feedA, s.qPump, { air: s.pickupAir });
    setFlow(flows.feedB, Math.max(0, s.qPump - s.qLeakLine), { air: s.pickupAir });
    setFlow(flows.rail, Math.max(0, (s.qPump - s.qLeakLine + s.qReturn) / 2));
    setFlow(flows.ret, s.qReturn);
    for (const fl of Object.values(flows)) fl.update(dt);

    // Presión en las tuberías
    // style (no atributo): la regla CSS .pipe-fluid le ganaría a un atributo de presentación.
    suction.inner.style.opacity = '0.25';
    feedA.inner.style.opacity = pressureOpacity(s.pPumpOut);
    feedB.inner.style.opacity = pressureOpacity(s.pRail);
    rail.inner.style.opacity = pressureOpacity(s.pRail);
    ret.inner.style.opacity = '0.25';
    gauge.setValue(s.pRail);

    // Filtro sucio
    filterDirt.setAttribute('width', (76 * clamp(f.filterClog, 0, 1)).toFixed(1));

    // Inyectores: pulso por cruce de ángulo (no se pierde ninguno entre frames)
    const delta = prevCrank === null ? 0 : wrap(s.crankAngle - prevCrank, 720);
    injectors.forEach((inj, i) => {
      const hit = s.injectors[i].open || (prevCrank !== null && crossed(prevCrank, delta, INJ_OFFSETS[i]) && s.rpmEff > 0);
      inj.intensity = hit ? 1 : expSmooth(inj.intensity, 0, dt, 0.04);
      const k = inj.intensity * clamp(s.mixtureRatio || 1, 0.2, 1.3);
      inj.spray.setAttribute('opacity', k.toFixed(2));
      inj.needle.setAttribute('transform', inj.intensity > 0.5 ? 'translate(0 -5)' : '');
      injWires[i].classList.toggle('pulse', inj.intensity > 0.5);
    });
    prevCrank = s.crankAngle;

    // Motor
    engineTagBg.setAttribute('class', `tag tag-${s.engineState}`);
    engineTagText.textContent = ENGINE_LABEL[s.engineState] || s.engineState;

    // Regulador: el resorte se comprime al abrir
    const springKey = s.regOpen.toFixed(2);
    if (springKey !== lastSpringKey) {
      lastSpringKey = springKey;
      const lift = 10 * s.regOpen;
      diaphragm.setAttribute('transform', `translate(0 ${lift.toFixed(1)})`);
      spring.setAttribute('points', springPoints(1162, 200 + lift, 238));
    }
    vacuumOn.g.style.display = f.vacuumHoseOff ? 'none' : '';
    vacuumOff.style.display = f.vacuumHoseOff ? '' : 'none';

    // Goteo de fugas
    dripT += dt;
    const lineOn = s.qLeakLine > 0.05;
    leakLineDrops.forEach((dr, i) => {
      const ph = (dripT * 1.5 + i / 3) % 1;
      dr.setAttribute('cx', '390');
      dr.setAttribute('cy', (338 + ph * 50).toFixed(1));
      dr.setAttribute('opacity', lineOn ? (1 - ph).toFixed(2) : '0');
    });
    const injOn = s.qLeakInj > 0.02;
    leakInjDrops.forEach((dr, i) => {
      const ph = (dripT * 1.2 + i / 2) % 1;
      dr.setAttribute('cx', String(INJ_X[1]));
      dr.setAttribute('cy', (RAIL_Y + 82 + ph * 40).toFixed(1));
      dr.setAttribute('opacity', injOn ? (1 - ph).toFixed(2) : '0');
    });
  }

  return {
    update,
    highlight() {},
    destroy() {
      for (const fl of Object.values(flows)) fl.destroy();
      root.remove();
    },
  };
}
