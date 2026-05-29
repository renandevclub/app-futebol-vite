/**
 * @file src/components/ui/component.js
 * @description Base factory para criação de componentes UI vanilla
 * Pattern: Factory function que retorna elemento DOM + helpers
 */

/**
 * Cria um elemento HTML com atributos, classes, children e event handlers.
 * @param {string} tag - Nome da tag HTML
 * @param {Object} [opts={}] - Opções
 * @param {Object<string,string>} [opts.attrs] - Atributos HTML
 * @param {string[]} [opts.classes] - Classes CSS
 * @param {string} [opts.html] - innerHTML
 * @param {string} [opts.text] - textContent (alternativa segura ao html)
 * @param {HTMLElement[]} [opts.children] - Elementos filhos
 * @param {Object<string,Function>} [opts.on] - Event listeners { eventName: handler }
 * @param {string} [opts.id] - ID do elemento
 * @param {Object<string,string>} [opts.data] - data-* attributes
 * @returns {HTMLElement}
 */
export function createElement(tag, opts = {}) {
  const el = document.createElement(tag);

  if (opts.id) el.id = opts.id;

  if (opts.attrs) {
    for (const [key, value] of Object.entries(opts.attrs)) {
      el.setAttribute(key, value);
    }
  }

  if (opts.classes) {
    el.classList.add(...opts.classes);
  }

  if (opts.html !== undefined) {
    el.innerHTML = opts.html;
  } else if (opts.text !== undefined) {
    el.textContent = opts.text;
  }

  if (opts.children) {
    for (const child of opts.children) {
      el.appendChild(child);
    }
  }

  if (opts.on) {
    for (const [event, handler] of Object.entries(opts.on)) {
      el.addEventListener(event, handler);
    }
  }

  if (opts.data) {
    for (const [key, value] of Object.entries(opts.data)) {
      el.dataset[key] = value;
    }
  }

  return el;
}

/**
 * Cria um DocumentFragment a partir de um array de elementos
 * @param {HTMLElement[]} children
 * @returns {DocumentFragment}
 */
export function fragment(...children) {
  const frag = document.createDocumentFragment();
  for (const child of children) {
    frag.appendChild(child);
  }
  return frag;
}

/**
 * Helper para querySelector no elemento
 * @param {HTMLElement} el
 * @param {string} selector
 * @returns {HTMLElement|null}
 */
export function qs(el, selector) {
  return el.querySelector(selector);
}

/**
 * Helper para querySelectorAll no elemento
 * @param {HTMLElement} el
 * @param {string} selector
 * @returns {NodeList}
 */
export function qsa(el, selector) {
  return el.querySelectorAll(selector);
}

export default { createElement, fragment, qs, qsa };
