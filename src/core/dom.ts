// Helpers DOM sin innerHTML (§17).

export type Child = Node | string | number | false | null | undefined | Child[];
export type Attrs = Record<string, unknown>;

/**
 * h('div', { class: 'x', onclick: fn }, 'texto', otroNodo)
 * Atributos `on*` con función se registran como listeners.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  setAttrs(node, attrs);
  append(node, children);
  return node;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export function setAttrs(node: HTMLElement, attrs: Attrs | undefined): void {
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      // Frontera DOM: los attrs `on*` de los helpers de core/dom llevan un listener.
      node.addEventListener(k.slice(2), v as EventListener);
    } else if (k === 'dataset' && isRecord(v)) {
      Object.assign(node.dataset, v);
    } else if (k === 'style' && isRecord(v)) {
      Object.assign(node.style, v);
    } else if (k in node && typeof v !== 'string') {
      Reflect.set(node, k, v);
    } else if (v === true) {
      node.setAttribute(k, '');
    } else if (typeof v === 'string' || typeof v === 'number') {
      node.setAttribute(k, String(v));
    }
  }
}

export function append(node: Element, children: readonly Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(node, c);
    else if (c instanceof Node) node.append(c);
    else node.append(document.createTextNode(String(c)));
  }
}

export function clear(node: Element): void {
  while (node.firstChild) node.firstChild.remove();
}
