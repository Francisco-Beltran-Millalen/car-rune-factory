// Rueda 60-2, sensores e igniter del COP (A12, spec ignition §8).

import { clamp } from '../../../../core/math.ts';
import { el, group, label } from '../../../../core/svg.ts';
import type { DrawerFactory } from '../../types.ts';
import { channelNumber } from '../../util.ts';

const R = 66;

/** Rueda 60-2 con el hueco de dos dientes, sensores e igniter. */
export const toothWheelDrawer: DrawerFactory = ({ part, layers }) => {
  const g = group(layers.parts);
  const cx = part.x + 110;
  const cy = part.y + 110;

  const wheel = group(g, { part: 'toothWheel' });
  el('circle', { cx, cy, r: R, class: 'wheel-body' }, wheel);
  const teeth = group(wheel);
  for (let i = 0; i < 60; i++) {
    if (i >= 58) continue; // el hueco de 2 dientes
    const a = (i * 6 * Math.PI) / 180;
    el(
      'line',
      {
        x1: cx + Math.cos(a) * R,
        y1: cy + Math.sin(a) * R,
        x2: cx + Math.cos(a) * (R + 9),
        y2: cy + Math.sin(a) * (R + 9),
        class: 'wheel-tooth',
      },
      teeth,
    );
  }
  el('circle', { cx, cy, r: 8, class: 'dist-hub' }, wheel);

  const sensor = group(g, { part: 'crankSensor' });
  const sensorBody = el('rect', { x: cx - R - 34, y: cy - 12, width: 26, height: 24, rx: 4, class: 'part-body' }, sensor);
  label(g, cx - R - 21, cy + 34, 'Cigüeñal', { anchor: 'middle', className: 'lbl-small part-label' });

  const cam = group(g, { part: 'camSensor' });
  el('circle', { cx: cx + R + 40, cy: cy - 30, r: 26, class: 'part-body' }, cam);
  el('ellipse', { cx: cx + R + 40, cy: cy - 42, rx: 7, ry: 20, class: 'cam-lobe' }, cam);
  const camDot = el('circle', { cx: cx + R + 12, cy: cy - 30, r: 6, class: 'sync-dot' }, cam);
  label(g, cx + R + 40, cy + 14, 'Leva', { anchor: 'middle', className: 'lbl-small part-label' });

  const igniter = group(g, { part: 'igniter' });
  el('rect', { x: cx - 40, y: cy + R + 28, width: 80, height: 34, rx: 6, class: 'part-body' }, igniter);
  label(g, cx, cy + R + 50, 'Igniter', { anchor: 'middle', className: 'lbl-small part-label' });

  return {
    g,
    update(channels): void {
      const angle = channelNumber(channels, 'angle');
      const gap = clamp(channelNumber(channels, 'gap'), 0, 1);
      const sync = channelNumber(channels, 'sync') > 0.5;
      wheel.setAttribute('transform', `rotate(${(angle / 2).toFixed(1)} ${cx} ${cy})`);
      sensorBody.setAttribute('x', String(cx - R - 34 - gap * 14));
      camDot.setAttribute('fill', sync ? 'var(--ok)' : 'var(--bad)');
    },
  };
};
