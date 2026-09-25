import type { ControlSpec, Narration, PartInfo, Preset, ReadoutSpec } from '../../core/types.ts';
import { defineModule } from '../../core/types.ts';
import { DEFAULT_FAULTS, DEFAULT_PARAMS, createDemoModel, type DemoModel, type DemoState } from './model.ts';
import { createDemoView } from './view.ts';

export default defineModule<DemoModel>({
  id: 'demo',
  title: 'Demo: estanque',
  summary: 'Módulo de prueba del shell: un estanque que se vacía por una válvula.',
  order: 99,
  viewBox: [0, 0, 800, 460],
  createModel: () => createDemoModel(),
  createView: createDemoView,
  defaultParams: DEFAULT_PARAMS,
  defaultFaults: DEFAULT_FAULTS,
  controls: [
    { type: 'slider', key: 'valve', label: 'Apertura de la válvula', min: 0, max: 1, step: 0.05, group: 'Válvula' },
    { type: 'toggle', key: 'inflow', label: 'Llenado abierto', group: 'Llenado' },
    { type: 'slider', key: 'inflowRate', label: 'Caudal de llenado', min: 0, max: 1000, step: 10, unit: 'L/h', group: 'Llenado',
      disabledWhen: (m) => !m.params.inflow },
    { type: 'button', action: 'refill', label: 'Llenar al tope', group: 'Llenado' },
  ] satisfies readonly ControlSpec<DemoModel>[],
  faults: [
    { key: 'clog', label: 'Salida tapada', kind: 'severity', description: 'Reduce el paso de la válvula.' },
    { key: 'leak', label: 'Fuga en el estanque', kind: 'toggle' },
  ],
  readouts: [
    { id: 'level', label: 'Nivel', unit: 'L', decimals: 1, get: (s) => s.level, history: true },
    { id: 'qOut', label: 'Caudal de salida', unit: 'L/h', decimals: 0, get: (s) => s.qOut, history: true,
      gauge: { min: 0, max: 600, green: [100, 500] } },
  ] satisfies readonly ReadoutSpec<DemoState>[],
  parts: {
    tank: { name: 'Estanque', what: 'Un depósito de líquido.', why: 'Guardar el fluido.', how: 'La presión en el fondo depende de la altura del líquido.', failures: ['Fuga → el nivel baja solo'] },
    valve: { name: 'Válvula de salida', what: 'Una llave de paso.', why: 'Regular el caudal.', how: 'Caudal ∝ apertura × √altura (Torricelli).', failures: ['Tapada → sale menos aunque esté abierta'] },
    inlet: { name: 'Entrada', what: 'Tubería de llenado.', why: 'Rellenar el estanque.', how: 'Aporta un caudal fijo.', failures: [] },
  } satisfies Readonly<Record<string, PartInfo>>,
  narrate(m): Narration[] {
    const s = m.state;
    const out: Narration[] = [];
    if (s.level <= 0) out.push({ level: 'bad', text: 'El estanque está vacío.' });
    if (m.faults.leak) out.push({ level: 'warn', text: 'Hay una fuga: el nivel baja aunque la válvula esté cerrada.' });
    if (m.faults.clog > 0.3 && m.params.valve > 0.5) out.push({ level: 'warn', text: 'La salida está tapada: sale poco caudal aunque la válvula esté abierta.' });
    if (s.qOut > 1) out.push({ level: 'info', text: `Sale líquido: más altura → más presión → más caudal.` });
    return out;
  },
  presets: [
    { id: 'clog', label: 'Caso: salida tapada', params: { valve: 1 }, faults: { clog: 0.8 }, note: 'Compara el caudal con la válvula abierta del todo.' },
  ] satisfies readonly Preset<DemoModel>[],
});
