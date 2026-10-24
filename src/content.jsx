import { createRoot } from 'react-dom/client';
import CursorOverlay from './CursorOverlay';

const rootId = 'accessibility-cursor-root';

function mountCursor() {
  if (document.getElementById(rootId) || !document.body) {
    return;
  }

  // Create isolated container with max 32-bit z-index
  const container = document.createElement('div');
  container.id = rootId;
  container.style.cssText =
    'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 2147483647 !important;';
  document.body.appendChild(container);

  // Attach open Shadow DOM — React 19 event delegation requires the shadow root to be
  // accessible so that synthetic events bubble correctly to the container root.
  // 'open' mode is safe here because our container already has pointer-events:none and
  // all overlay styles are self-contained within the shadow.
  const shadow = container.attachShadow({ mode: 'open' });

  // Inject a style sheet inside the shadow to hide the host-page native cursor
  // while hands-free tracking is active, and to reset any host-page CSS leaking in.
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; }
  `;
  shadow.appendChild(style);

  const shadowHost = document.createElement('div');
  shadowHost.style.cssText = 'position: fixed; top: 0; left: 0; pointer-events: none;';
  shadow.appendChild(shadowHost);

  console.log('Mounting Cursor Overlay...');
  const root = createRoot(shadowHost);
  root.render(<CursorOverlay />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountCursor);
} else {
  mountCursor();
}
