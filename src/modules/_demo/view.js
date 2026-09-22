import { el, group, pipe, label, gaugeSvg } from '../../core/svg.js';
import { createFlow, PX_PER_LH } from '../../core/particles.js';

export function createDemoView({ svg, model }) {
  const root = group(svg, { class: 'demo' });
  const inPipe = pipe(root, [[80, 60], [260, 60], [260, 140]], { part: 'inlet' });
  const tank = group(root, { part: 'tank' });
  el('rect', { x: 150, y: 140, width: 220, height: 260, rx: 10, class: 'part-body' }, tank);
  const liquid = el('rect', { x: 156, y: 146, width: 208, height: 0, class: 'liquid fluid-fuel' }, tank);
  label(tank, 260, 425, 'Estanque', { anchor: 'middle' });
  const outPipe = pipe(root, [[370, 370], [520, 370], [520, 250], [700, 250]], { part: 'valve' });
  const valve = el('circle', { cx: 440, cy: 370, r: 16, class: 'part-body', part: 'valve' }, root);
  const valveBar = el('line', { x1: 440, y1: 356, x2: 440, y2: 384, class: 'valve-bar', part: 'valve' }, root);
  const gauge = gaugeSvg(root, { cx: 620, cy: 110, r: 55, min: 0, max: 600, unit: 'L/h', part: 'valve' });
  const layer = group(root, { class: 'particles' });
  const flowIn = createFlow({ path: inPipe.path, layer });
  const flowOut = createFlow({ path: outPipe.path, layer });
  void valve;

  return {
    update(dt) {
      const s = model.state;
      const hgt = (s.level / 100) * 248;
      liquid.setAttribute('y', String(394 - hgt));
      liquid.setAttribute('height', String(hgt));
      valveBar.setAttribute('transform', `rotate(${model.params.valve * 90} 440 370)`);
      flowIn.setSpeed(s.qIn * PX_PER_LH);
      flowIn.setDensity(s.qIn > 0 ? 1 : 0);
      flowOut.setSpeed(s.qOut * PX_PER_LH);
      flowOut.setDensity(s.qOut > 0.5 ? 1 : 0);
      flowIn.update(dt);
      flowOut.update(dt);
      gauge.setValue(s.qOut);
    },
    highlight() {},
    destroy() {
      flowIn.destroy();
      flowOut.destroy();
      root.remove();
    },
  };
}
