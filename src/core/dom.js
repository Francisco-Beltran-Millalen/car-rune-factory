// Helpers DOM sin innerHTML (§17).

/**
 * h('div', { class: 'x', onclick: fn }, 'texto', otroNodo)
 * Atributos `on*` con función se registran como listeners.
 */
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  setAttrs(node, attrs);
  append(node, children);
  return node;
}

export function setAttrs(node, attrs) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k in node && typeof v !== 'string') node[k] = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
}

export function append(node, children) {
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(node) {
  while (node.firstChild) node.firstChild.remove();
}

/** Formatea un número con decimales fijos y separador decimal con coma. */
export function fmt(v, decimals = 1) {
  if (!Number.isFinite(v)) return '—';
  return v.toFixed(decimals).replace('.', ',');
}
