// Router por hash: '#/fuel' → 'fuel'; '' o '#/' → null (portada).

export function parseHash(hash) {
  const m = /^#\/([\w-]+)/.exec(hash || '');
  return m ? m[1] : null;
}

/** @param {(id: string|null) => void} onRoute */
export function createRouter(onRoute) {
  const handler = () => onRoute(parseHash(location.hash));
  return {
    start() {
      window.addEventListener('hashchange', handler);
      handler();
    },
    go(id) {
      location.hash = id ? `#/${id}` : '#/';
    },
    destroy() {
      window.removeEventListener('hashchange', handler);
    },
  };
}
