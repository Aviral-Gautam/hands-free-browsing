// src/utils/domUtils.js

const OVERLAY_ROOT_ID = 'accessibility-cursor-root';

/**
 * Pierces through open Shadow Roots recursively to locate the deepest element at (x, y).
 * Skips the hands-free cursor overlay's own shadow DOM to avoid self-targeting.
 */
export function deepElementFromPoint(x, y) {
  let el = document.elementFromPoint(x, y);
  if (!el) return null;

  // Don't target our own accessibility overlay container or anything inside it
  if (el.id === OVERLAY_ROOT_ID || el.closest?.(`.${OVERLAY_ROOT_ID}`) || el.closest?.(`#${OVERLAY_ROOT_ID}`)) {
    return null;
  }

  // Drill down through open shadow roots, but skip our own overlay shadow root
  let guard = 0;
  while (el && el.shadowRoot && guard < 10) {
    // Never drill into our own overlay shadow root
    if (el.id === OVERLAY_ROOT_ID) break;
    guard++;
    const inner = el.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === el) break;
    el = inner;
  }

  return el;
}

/**
 * Checks whether an element is interactive or a custom Web Component action target.
 */
export function isInteractiveElement(el) {
  if (!el || el === document.body || el === document.documentElement) return false;

  // Accessibility overlay check — skip our own cursor overlay elements
  if (el.id === OVERLAY_ROOT_ID || el.closest?.(`#${OVERLAY_ROOT_ID}`)) {
    return false;
  }

  const tagName = el.tagName.toLowerCase();

  // 1. Standard interactive HTML tags
  if (['button', 'a', 'input', 'textarea', 'select', 'details', 'summary', 'video'].includes(tagName)) {
    return true;
  }

  // 2. Contenteditable
  if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
    return true;
  }

  // 3. ARIA interactive roles
  const role = el.getAttribute('role');
  if (role && ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio', 'switch', 'slider', 'searchbox', 'option'].includes(role)) {
    return true;
  }

  // 4. Tabindex
  if (el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1') {
    return true;
  }

  // 5. Custom Web Components (YouTube, Polymer, Material, Shoelace, etc.)
  if (tagName.includes('-')) {
    if (
      tagName.includes('button') ||
      tagName.includes('link') ||
      tagName.includes('thumbnail') ||
      tagName.includes('card') ||
      tagName.includes('item') ||
      tagName.includes('chip') ||
      tagName.includes('badge') ||
      tagName.startsWith('ytd-') ||
      tagName.startsWith('yt-') ||
      tagName.startsWith('tp-yt-')
    ) {
      return true;
    }
  }

  // 6. Direct click handlers
  if (typeof el.onclick === 'function' || el.hasAttribute('onclick')) {
    return true;
  }

  // 7. Computed pointer cursor
  try {
    const style = window.getComputedStyle(el);
    if (style.cursor === 'pointer') {
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}

/**
 * Traverses upwards to find the closest interactive element or custom Web Component host.
 */
export function findInteractiveTarget(el) {
  if (!el) return null;

  let current = el;
  let depth = 0;
  while (current && current !== document.body && depth < 10) {
    if (isInteractiveElement(current)) {
      return current;
    }
    // Check parent or shadow host
    current = current.parentElement || current.getRootNode()?.host;
    depth++;
  }

  return null;
}

/**
 * Proximity Radar: Scans nearby coordinates in radial rings around (x, y)
 * to lock onto interactive elements even when gaze/cursor is slightly off-target.
 */
export function findNearbyInteractiveTarget(x, y, radius = 45) {
  // 1. Direct hit check
  const directEl = deepElementFromPoint(x, y);
  const directTarget = findInteractiveTarget(directEl);
  if (directTarget && directTarget !== document.body) {
    const rect = directTarget.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      return {
        element: directTarget,
        rect,
        distance: Math.hypot(x - cx, y - cy)
      };
    }
  }

  // 2. Radial proximity scan (rings at 15px, 30px, 45px)
  const steps = [
    // 4 cardinal points (16px)
    [0, -16], [0, 16], [-16, 0], [16, 0],
    // 8 points (30px)
    [0, -30], [21, -21], [30, 0], [21, 21], [0, 30], [-21, 21], [-30, 0], [-21, -21],
    // Outer points (radius)
    [0, -radius], [radius, 0], [0, radius], [-radius, 0]
  ];

  let bestMatch = null;
  let minDistance = Infinity;
  const testedElements = new Set();

  for (const [dx, dy] of steps) {
    const sampleX = x + dx;
    const sampleY = y + dy;

    if (sampleX < 0 || sampleX > window.innerWidth || sampleY < 0 || sampleY > window.innerHeight) {
      continue;
    }

    const raw = deepElementFromPoint(sampleX, sampleY);
    const candidate = findInteractiveTarget(raw);

    if (candidate && candidate !== document.body && !testedElements.has(candidate)) {
      testedElements.add(candidate);
      const rect = candidate.getBoundingClientRect();

      // Skip elements that cover the entire screen inappropriately
      if (rect.width > 0 && rect.height > 0 && rect.width < window.innerWidth * 0.95) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(x - cx, y - cy);

        if (dist < minDistance && dist <= radius + 15) {
          minDistance = dist;
          bestMatch = { element: candidate, rect, distance: dist };
        }
      }
    }
  }

  return bestMatch;
}

/**
 * Extracts a descriptive label and element type for the accessibility badge pill.
 */
export function getElementDescription(el) {
  if (!el) return { type: 'Element', text: '' };

  const tagName = el.tagName.toLowerCase();
  const role = el.getAttribute('role');
  const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('title') || '';

  // Look for YouTube video title or primary text
  let innerText = '';
  if (tagName.includes('ytd-') || tagName.includes('yt-')) {
    const titleEl = el.querySelector?.('#video-title, #title, #channel-name, yt-formatted-string');
    if (titleEl) {
      innerText = titleEl.textContent || titleEl.innerText || '';
    }
  }

  if (!innerText) {
    innerText = (el.innerText || el.textContent || '').trim();
  }

  let type = 'Element';
  if (tagName === 'button' || role === 'button' || tagName.includes('button')) {
    type = 'Button';
  } else if (tagName === 'a' || role === 'link') {
    type = 'Link';
  } else if (tagName === 'input' || tagName === 'textarea' || role === 'searchbox') {
    type = el.type === 'search' || el.id?.includes('search') ? 'Search' : 'Input';
  } else if (tagName === 'video') {
    type = 'Video';
  } else if (tagName.includes('thumb') || tagName.includes('video') || tagName.includes('rich-item')) {
    type = 'Video Card';
  }

  const label = (ariaLabel || innerText || el.placeholder || el.id || '').replace(/\s+/g, ' ').trim().slice(0, 26);

  return {
    type,
    text: label
  };
}

/**
 * Dispatches a complete synthetic pointer/mouse event sequence.
 */
export function dispatchPointerEventSequence(element, x, y) {
  if (!element) return;

  const eventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y,
    screenX: x,
    screenY: y,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: 1
  };

  if (typeof element.focus === 'function') {
    try {
      element.focus({ preventScroll: true });
    } catch {
      element.focus();
    }
  }

  element.dispatchEvent(new PointerEvent('pointerdown', eventInit));
  element.dispatchEvent(new MouseEvent('mousedown', eventInit));
  element.dispatchEvent(new PointerEvent('pointerup', { ...eventInit, buttons: 0 }));
  element.dispatchEvent(new MouseEvent('mouseup', { ...eventInit, buttons: 0 }));
  element.dispatchEvent(new MouseEvent('click', { ...eventInit, buttons: 0 }));

  if (typeof element.click === 'function') {
    try {
      element.click();
    } catch (e) {
      console.debug('Fallback click error:', e);
    }
  }
}

/**
 * Dispatches hover/pointermove events to trigger website hover styles and tooltips.
 */
export function dispatchHoverMove(element, x, y) {
  if (!element) return;

  const eventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true
  };

  element.dispatchEvent(new PointerEvent('pointermove', eventInit));
  element.dispatchEvent(new MouseEvent('mousemove', eventInit));
}

/**
 * Inserts text into form fields, textareas, and contenteditables with framework event dispatching.
 */
export function insertTextIntoField(targetEl, text, shouldSubmit = false) {
  if (!targetEl) return false;

  targetEl.focus();

  if (targetEl.isContentEditable) {
    document.execCommand('insertText', false, text);
  } else {
    const prototype = Object.getPrototypeOf(targetEl);
    const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(targetEl, text);
    } else {
      targetEl.value = text;
    }

    targetEl.dispatchEvent(new Event('input', { bubbles: true }));
    targetEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  if (shouldSubmit) {
    const enterInit = {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    };
    targetEl.dispatchEvent(new KeyboardEvent('keydown', enterInit));
    targetEl.dispatchEvent(new KeyboardEvent('keypress', enterInit));
    targetEl.dispatchEvent(new KeyboardEvent('keyup', enterInit));

    const form = targetEl.form || targetEl.closest('form');
    if (form) {
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.submit();
      }
    }
  }

  return true;
}
