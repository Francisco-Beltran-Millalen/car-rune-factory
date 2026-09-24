// Router por hash: #/lab/<id>, #/stage/<id>, #/ portada (CONTRATOS.md §6).

/**
 * Parsea el hash de la URL.
 * @param {string|null} hash
 * @returns {{ kind: 'lab'|'stage'|'home', id: string|null }}
 */
export function parseHash(hash) {
  const h = (hash || '').trim();
  if (!h || h === '#' || h === '#/') {
    return { kind: 'home', id: null };
  }
  const labMatch = /^#\/lab\/([\w-]+)$/.exec(h);
  if (labMatch) {
    return { kind: 'lab', id: labMatch[1] };
  }
  const stageMatch = /^#\/stage\/([\w-]+)$/.exec(h);
  if (stageMatch) {
    return { kind: 'stage', id: stageMatch[1] };
  }
  // Compatibilidad: #/<id> redirige a lab
  const compMatch = /^#\/([\w-]+)$/.exec(h);
  if (compMatch && compMatch[1] !== 'lab' && compMatch[1] !== 'stage') {
    return { kind: 'lab', id: compMatch[1] };
  }
  return { kind: 'home', id: null };
}

/**
 * @param {(route: { kind: 'lab'|'stage'|'home', id: string|null }) => void} onRoute
 * @param {Window|Object} [win]
 */
export function createRouter(onRoute, win = typeof window !== 'undefined' ? window : globalThis.window) {
  const getLoc = () => win?.location || (typeof location !== 'undefined' ? location : null);

  const handler = () => {
    const loc = getLoc();
    const raw = loc?.hash || '';
    const compMatch = /^#\/([\w-]+)$/.exec(raw);
    if (compMatch && compMatch[1] !== 'lab' && compMatch[1] !== 'stage') {
      if (loc && typeof loc.replace === 'function') {
        loc.replace(`#/lab/${compMatch[1]}`);
        return;
      }
    }
    onRoute(parseHash(raw));
  };

  return {
    start() {
      if (win && typeof win.addEventListener === 'function') {
        win.addEventListener('hashchange', handler);
      }
      handler();
    },
    go(target) {
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
        loc.hash = `#/stage/${target.id}`;
      } else {
        loc.hash = `#/lab/${target.id}`;
      }
    },
    destroy() {
      if (win && typeof win.removeEventListener === 'function') {
        win.removeEventListener('hashchange', handler);
      }
    },
  };
}
