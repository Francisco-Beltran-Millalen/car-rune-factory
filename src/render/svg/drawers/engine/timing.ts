// Tren de distribución (A11, spec §8): piñones, cadena o correa, tensor, guía
// y el inset del chavetero. Geometría una vez; `update` muta atributos (§9).
// Las coordenadas son relativas a `part.x/part.y` (la región 600–960 × 40–700).

import { el, group, label } from '../../../../core/svg.ts';
import type { DrawerFactory } from '../../types.ts';
import { channelNumber, channelString } from '../../util.ts';

const CRANK = { x: 100, y: 500, r: 40 };
const CAM = { x: 100, y: 140, r: 40 };

function chainPathD(ox: number, oy: number): string {
  const cx = ox + CRANK.x;
  const cy = oy + CRANK.y;
  const mx = ox + CAM.x;
  const my = oy + CAM.y;
  const r = CRANK.r;
  return `M ${cx - r} ${cy} L ${mx - r} ${my} A ${r} ${r} 0 0 1 ${mx + r} ${my} L ${cx + r} ${cy} A ${r} ${r} 0 0 1 ${cx - r} ${cy} Z`;
}

function sprocket(parent: SVGGElement, cx: number, cy: number, r: number, part: string): SVGGElement {
  const g = group(parent, { part });
  el('circle', { cx, cy, r, class: 'sprocket-body' }, g);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    el(
      'line',
      {
        x1: cx + Math.cos(a) * (r - 4),
        y1: cy + Math.sin(a) * (r - 4),
        x2: cx + Math.cos(a) * (r + 4),
        y2: cy + Math.sin(a) * (r + 4),
        class: 'sprocket-tooth',
      },
      g,
    );
  }
  return g;
}

/** Cadena o correa, tensor, guía, piñones y zoom del chavetero. */
export const timingDriveDrawer: DrawerFactory = ({ part, layers }) => {
  const ox = part.x;
  const oy = part.y;
  const g = group(layers.parts);
  const moving = group(g);
  const d = chainPathD(ox, oy);

  // Cadena: path y eslabones que avanzan con el cigüeñal.
  const chainGroup = group(moving, { part: 'timingChain' });
  const chainPath = el('path', { d, class: 'chain-path' }, chainGroup);
  const chainLinks = Array.from({ length: 40 }, () =>
    el('circle', { r: 3.4, class: 'chain-link' }, chainGroup),
  );

  // Correa dentada (sólo DOHC, se muestra con `drive`).
  const beltGroup = group(moving, { part: 'timingBelt' });
  el('path', { d, class: 'belt-path' }, beltGroup);
  for (const [cx, cy] of [
    [ox + CAM.x, oy + CAM.y],
    [ox + CRANK.x, oy + CRANK.y],
  ] as const) {
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      el(
        'line',
        {
          x1: cx + Math.cos(a) * (CAM.r + 3),
          y1: cy + Math.sin(a) * (CAM.r + 3),
          x2: cx + Math.cos(a) * (CAM.r + 9),
          y2: cy + Math.sin(a) * (CAM.r + 9),
          class: 'belt-tooth',
        },
        beltGroup,
      );
    }
  }
  beltGroup.style.display = 'none';

  // Piñón del cigüeñal (rota) con perno y chaveta.
  const crankGroup = sprocket(moving, ox + CRANK.x, oy + CRANK.y, CRANK.r, 'crankSprocket');
  const bolt = el('circle', { cx: ox + CRANK.x, cy: oy + CRANK.y, r: 8, class: 'crank-bolt', part: 'crankBolt' }, moving);
  const key = el('rect', { x: ox + CRANK.x - 3, y: oy + CRANK.y - 34, width: 6, height: 14, rx: 2, class: 'crank-key', part: 'crankKey' }, moving);

  // Piñón de la leva (gira a la mitad) con su marca de sincronización.
  const camGroup = sprocket(moving, ox + CAM.x, oy + CAM.y, CAM.r, 'camSprocket');
  const camMark = el('line', { x1: ox + CAM.x, y1: oy + CAM.y, x2: ox + CAM.x, y2: oy + CAM.y - CAM.r + 6, class: 'cam-mark' }, camGroup);
  el('path', { d: `M ${ox + CAM.x} ${oy + CAM.y - CAM.r - 16} l 7 11 h -14 Z`, class: 'cam-ref' }, moving);
  label(g, ox + CAM.x + 54, oy + CAM.y - 34, 'Referencia', { className: 'lbl-small part-label' });

  // Tensor y guía.
  const tensioner = group(moving, { part: 'tensioner' });
  const shoe = el('rect', { x: ox + CRANK.x + CRANK.r + 10, y: oy + 250, width: 12, height: 110, rx: 5, class: 'shoe' }, tensioner);
  el('line', { x1: ox + CRANK.x + CRANK.r + 22, y1: oy + 305, x2: ox + CRANK.x + CRANK.r + 72, y2: oy + 305, class: 'plunger' }, tensioner);
  const guide = group(moving, { part: 'chainGuide' });
  el('rect', { x: ox + CRANK.x - CRANK.r - 22, y: oy + 220, width: 12, height: 130, rx: 5, class: 'shoe guide' }, guide);

  // Inset del chavetero: eje fijo y cubo que baila con el juego.
  const inset = group(moving, { part: 'crankKey' });
  el('rect', { x: ox + 10, y: oy + 540, width: 140, height: 110, rx: 10, class: 'inset-box' }, inset);
  el('circle', { cx: ox + 80, cy: oy + 595, r: 22, class: 'inset-shaft' }, inset);
  el('rect', { x: ox + 73, y: oy + 573, width: 14, height: 10, rx: 2, class: 'inset-slot' }, inset);
  const hub = group(inset);
  el('circle', { cx: ox + 80, cy: oy + 595, r: 30, class: 'inset-hub' }, hub);
  el('line', { x1: ox + 80, y1: oy + 595, x2: ox + 80, y2: oy + 571, class: 'inset-mark' }, hub);
  label(g, ox + 80, oy + 672, 'Chavetero (zoom)', { anchor: 'middle', className: 'lbl-small part-label' });

  label(g, ox + CRANK.x, oy + CRANK.y + 68, 'Piñón del cigüeñal', { anchor: 'middle', className: 'lbl-small part-label' });
  label(g, ox + CAM.x, oy + CAM.y - 68, 'Piñón de la leva', { anchor: 'middle', className: 'lbl-small part-label' });

  let chainLength = 0;
  let lastDrive = '';

  return {
    g,
    update(channels): void {
      const crank = channelNumber(channels, 'crank');
      const cam = channelNumber(channels, 'cam');
      const slack = channelNumber(channels, 'slack');
      const play = channelNumber(channels, 'play');
      const knock = channelNumber(channels, 'knock');
      const rattle = channelNumber(channels, 'rattle');
      const guideBroken = channelNumber(channels, 'guideBroken') > 0.5;
      const drive = channelString(channels, 'drive', 'chain');

      if (drive !== lastDrive) {
        lastDrive = drive;
        const belt = drive === 'belt';
        chainGroup.style.display = belt ? 'none' : '';
        beltGroup.style.display = belt ? '' : 'none';
      }

      // Golpeteo: sacudida corta del piñón. Ruido: la cadena se comba.
      const shake = knock > 0 ? knock * 2.5 : 0;
      crankGroup.setAttribute('transform', `rotate(${crank.toFixed(1)} ${ox + CRANK.x} ${oy + CRANK.y}) translate(${shake.toFixed(1)} 0)`);
      bolt.setAttribute('transform', `rotate(${crank.toFixed(1)} ${ox + CRANK.x} ${oy + CRANK.y})`);
      key.setAttribute('transform', `rotate(${crank.toFixed(1)} ${ox + CRANK.x} ${oy + CRANK.y})`);
      camGroup.setAttribute('transform', `rotate(${(cam / 2).toFixed(1)} ${ox + CAM.x} ${oy + CAM.y})`);
      camMark.classList.toggle('sheared', channelNumber(channels, 'sheared') > 0.5);

      // Tensor: el émbolo sale con la holgura; la guía se parte si está rota.
      shoe.setAttribute('x', String(ox + CRANK.x + CRANK.r + 10 + slack * 22));
      guide.classList.toggle('broken', guideBroken);

      const wobble = Math.sin((crank * Math.PI) / 90) * rattle * 3;
      chainGroup.setAttribute('transform', `translate(${wobble.toFixed(1)} 0)`);
      beltGroup.setAttribute('transform', `translate(${wobble.toFixed(1)} 0)`);

      // Eslabones: avanzan con el cigüeñal (dos vueltas de cadena por ciclo).
      if (chainLength === 0) chainLength = chainPath.getTotalLength();
      if (chainLength > 0) {
        const base = ((crank / 360) % 1) * chainLength;
        for (let i = 0; i < chainLinks.length; i++) {
          const link = chainLinks[i];
          if (!link) continue;
          const pos = (base + (i / chainLinks.length) * chainLength) % chainLength;
          const point = chainPath.getPointAtLength(pos);
          link.setAttribute('cx', point.x.toFixed(1));
          link.setAttribute('cy', point.y.toFixed(1));
        }
      }

      // El cubo del inset baila con el juego (el ovalado se ve agrandado).
      const wobbleInset = play > 0 ? Math.sin((crank * Math.PI) / 90) * play * 0.6 : 0;
      hub.setAttribute('transform', `rotate(${wobbleInset.toFixed(1)} ${ox + 80} ${oy + 595})`);
    },
  };
};
