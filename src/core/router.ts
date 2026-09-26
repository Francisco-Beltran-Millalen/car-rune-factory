// Router por hash: #/lab/<id>, #/stage/<id>, #/ portada (CONTRATOS.md §6).

export type RouteKind = 'lab' | 'stage' | 'home';

export interface Route {
  kind: RouteKind;
  id: string | null;
}

/** Destino de `go`: ruta completa o atajo (`'fuel'` → `#/lab/fuel`). */
export interface RouteTarget {
  kind: RouteKind;
  id?: string | null;
}

/** Interfaz mínima de `location` para poder inyectar un doble en tests. */
export interface HashLocation {
  hash: string;
  replace?(url: string): void;
}

/** Interfaz mínima de `window` para poder inyectar un doble en tests. */
export interface HashWindow {
  location: HashLocation;
  addEventListener?(type: 'hashchange', listener: () => void): void;
  removeEventListener?(type: 'hashchange', listener: () => void): void;
}

export interface Router {
  start(): void;
  go(target: string | RouteTarget | null): void;
  destroy(): void;
}

/** Rutas viejas que redirigen a la variante moderna (A11–A13). */
export const LAB_ALIASES: Readonly<Record<string, string>> = {
  'four-stroke': 'four-stroke-dohc',
  ignition: 'ignition-cop',
  cooling: 'cooling-electric',
};

export function resolveLabAlias(id: string): string {
  return LAB_ALIASES[id] ?? id;
}

/** Parsea el hash de la URL. */
export function parseHash(hash: string | null): Route {
  const h = (hash ?? '').trim();
  if (!h || h === '#' || h === '#/') {
    return { kind: 'home', id: null };
  }
  const labMatch = /^#\/lab\/([\w-]+)$/.exec(h);
  if (labMatch?.[1]) {
    return { kind: 'lab', id: resolveLabAlias(labMatch[1]) };
  }
  const stageMatch = /^#\/stage\/([\w-]+)$/.exec(h);
  if (stageMatch?.[1]) {
    return { kind: 'stage', id: stageMatch[1] };
  }
  // Compatibilidad: #/<id> redirige a lab
  const compMatch = /^#\/([\w-]+)$/.exec(h);
  if (compMatch?.[1] && compMatch[1] !== 'lab' && compMatch[1] !== 'stage') {
    return { kind: 'lab', id: resolveLabAlias(compMatch[1]) };
  }
  return { kind: 'home', id: null };
}

export function createRouter(
  onRoute: (route: Route) => void,
  win: HashWindow | null = window,
): Router {
  const getLoc = (): HashLocation | null =>
    win?.location ?? (typeof location !== 'undefined' ? location : null);

  const handler = (): void => {
    const loc = getLoc();
    const raw = loc?.hash ?? '';
    const compMatch = /^#\/([\w-]+)$/.exec(raw);
    if (compMatch?.[1] && compMatch[1] !== 'lab' && compMatch[1] !== 'stage') {
      if (loc && typeof loc.replace === 'function') {
        loc.replace(`#/lab/${compMatch[1]}`);
        return;
      }
    }
    onRoute(parseHash(raw));
  };

  return {
    start(): void {
      if (win && typeof win.addEventListener === 'function') {
        win.addEventListener('hashchange', handler);
      }
      handler();
    },
    go(target): void {
      const loc = getLoc();
      if (!loc) return;
      if (!target) {
        loc.hash = '#/';
      } else if (typeof target === 'string') {
        if (target.startsWith('#/')) {
          loc.hash = target;
        } else if (target.startsWith('lab/') || target.startsWith('stage/')) {
          loc.hash = `#/${target}`;
        } else {
          loc.hash = `#/lab/${target}`;
        }
      } else if (target.kind === 'home') {
        loc.hash = '#/';
      } else if (target.kind === 'stage') {
        loc.hash = `#/stage/${target.id ?? ''}`;
      } else {
        loc.hash = `#/lab/${target.id ?? ''}`;
      }
    },
    destroy(): void {
      if (win && typeof win.removeEventListener === 'function') {
        win.removeEventListener('hashchange', handler);
      }
    },
  };
}
