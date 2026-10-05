// ⟲ y los presets llaman `model.reset()`: el modelo tiene que quedar igual a
// uno recién creado (§3), con todo lo que guarda estado (solver, elementos,
// rng, bus de señales, señales del módulo).
import { describe, it, expect } from 'vitest';
import type { ModuleDescriptor, ParamRecord } from '../../src/core/types.ts';
import { modules } from '../../src/modules/registry.ts';

type AnyModel = ReturnType<ModuleDescriptor['createModel']>;

/** Las fallas de severidad a la mitad, los toggles prendidos y los enum en su
 *  última opción: así se ejercita también el azar (relé intermitente…). */
function allFaults(desc: ModuleDescriptor): ParamRecord {
  const faults: ParamRecord = {};
  for (const f of desc.faults) {
    if (f.kind === 'severity') faults[f.key] = 0.5;
    else if (f.kind === 'toggle') faults[f.key] = true;
    else {
      const last = f.options?.[f.options.length - 1];
      if (last) faults[f.key] = last.value;
    }
  }
  return faults;
}

function drive(model: AnyModel, faults: ParamRecord): string {
  Object.assign(model.faults, faults);
  const hasKey = 'ignitionKey' in model.params;
  const phases: [string, number][] = [['on', 1500], ['start', 1000], ['run', 2500]];
  for (const [key, steps] of phases) {
    if (hasKey) model.params['ignitionKey'] = key;
    for (let i = 0; i < steps; i++) model.step(0.001);
  }
  return JSON.stringify(model.state);
}

describe('reset deja el modelo como uno recién creado (§3)', () => {
  for (const desc of modules) {
    for (const [label, faults] of [['sin fallas', {}], ['con fallas', allFaults(desc)]] as const) {
      it(`${desc.id} ${label}`, () => {
        const fresh = drive(desc.createModel(), faults);
        const used = desc.createModel();
        drive(used, faults);
        used.reset();
        expect(used.time).toBe(0);
        expect(drive(used, faults)).toBe(fresh);
      });
    }
  }
});
