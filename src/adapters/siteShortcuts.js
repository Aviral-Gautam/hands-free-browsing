// src/adapters/siteShortcuts.js

/**
 * Dispatches a synthetic keyboard event with proper keyCode and properties.
 */
export function dispatchShortcutKey(key, code, options = {}) {
  const isShift = Boolean(options.shiftKey);
  const target = document.activeElement && document.activeElement !== document.body
    ? document.activeElement
    : document.body;

  const eventInit = {
    key,
    code,
    bubbles: true,
    cancelable: true,
    view: window,
    shiftKey: isShift,
    ...options
  };

  target.dispatchEvent(new KeyboardEvent('keydown', eventInit));
  target.dispatchEvent(new KeyboardEvent('keyup', eventInit));
}

/**
 * Finds the primary active or playing HTML5 video element on the page.
 */
export function getActiveVideoElement() {
  const videos = Array.from(document.querySelectorAll('video'));
  if (videos.length === 0) return null;

  // Find playing video first
  const playing = videos.find((v) => !v.paused && !v.ended && v.readyState > 2);
  if (playing) return playing;

  // Otherwise return largest visible video
  return videos.reduce((largest, current) => {
    const rect = current.getBoundingClientRect();
    const area = rect.width * rect.height;
    const largestRect = largest ? largest.getBoundingClientRect() : null;
    const largestArea = largestRect ? largestRect.width * largestRect.height : 0;
    return area > largestArea ? current : largest;
  }, null);
}

/**
 * YouTube-specific controller with keyboard dispatch and direct DOM fallback.
 */
export class YouTubeAdapter {
  static isYouTube() {
    return window.location.hostname.includes('youtube.com');
  }

  static togglePlay() {
    dispatchShortcutKey('k', 'KeyK');
    const video = getActiveVideoElement();
    if (video) {
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    }
  }

  static rewind(seconds = 10) {
    dispatchShortcutKey('j', 'KeyJ');
    const video = getActiveVideoElement();
    if (video) {
      video.currentTime = Math.max(0, video.currentTime - seconds);
    }
  }

  static forward(seconds = 10) {
    dispatchShortcutKey('l', 'KeyL');
    const video = getActiveVideoElement();
    if (video) {
      video.currentTime = Math.min(video.duration || Infinity, video.currentTime + seconds);
    }
  }

  static toggleMute() {
    dispatchShortcutKey('m', 'KeyM');
    const video = getActiveVideoElement();
    if (video) {
      video.muted = !video.muted;
    }
  }

  static toggleFullscreen() {
    const fsBtn = document.querySelector('.ytp-fullscreen-button');
    if (fsBtn) {
      fsBtn.click();
    } else {
      dispatchShortcutKey('f', 'KeyF');
      const video = getActiveVideoElement();
      if (video) {
        if (!document.fullscreenElement) {
          video.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      }
    }
  }

  static toggleCaptions() {
    const subBtn = document.querySelector('.ytp-subtitles-button');
    if (subBtn) {
      subBtn.click();
    } else {
      dispatchShortcutKey('c', 'KeyC');
    }
  }

  static nextVideo() {
    const nextBtn = document.querySelector('.ytp-next-button');
    if (nextBtn) {
      nextBtn.click();
    } else {
      dispatchShortcutKey('N', 'KeyN', { shiftKey: true });
    }
  }

  static focusSearch() {
    const searchInput = document.querySelector('ytd-searchbox input#search') ||
      document.querySelector('input[name="search_query"]') ||
      document.querySelector('input#search');

    if (searchInput) {
      searchInput.focus();
      searchInput.select?.();
      return true;
    }
    dispatchShortcutKey('/', 'Slash');
    return false;
  }
}

/**
 * Generic HTML5 Video adapter fallback.
 */
export class HTML5VideoAdapter {
  static togglePlay() {
    const video = getActiveVideoElement();
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  static rewind(seconds = 10) {
    const video = getActiveVideoElement();
    if (!video) return;
    video.currentTime = Math.max(0, video.currentTime - seconds);
  }

  static forward(seconds = 10) {
    const video = getActiveVideoElement();
    if (!video) return;
    video.currentTime = Math.min(video.duration || Infinity, video.currentTime + seconds);
  }

  static toggleMute() {
    const video = getActiveVideoElement();
    if (!video) return;
    video.muted = !video.muted;
  }

  static toggleFullscreen() {
    const video = getActiveVideoElement();
    if (!video) return;
    if (!document.fullscreenElement) {
      video.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }
}

/**
 * Unified Shortcut Dispatcher.
 */
export function executeMediaAction(actionName) {
  const isYT = YouTubeAdapter.isYouTube();
  const adapter = isYT ? YouTubeAdapter : HTML5VideoAdapter;

  switch (actionName) {
    case 'togglePlay':
      adapter.togglePlay();
      break;
    case 'rewind':
      adapter.rewind(10);
      break;
    case 'forward':
      adapter.forward(10);
      break;
    case 'toggleMute':
      adapter.toggleMute();
      break;
    case 'toggleFullscreen':
      adapter.toggleFullscreen();
      break;
    case 'toggleCaptions':
      if (isYT) YouTubeAdapter.toggleCaptions();
      break;
    case 'nextVideo':
      if (isYT) YouTubeAdapter.nextVideo();
      break;
    case 'focusSearch':
      if (isYT) YouTubeAdapter.focusSearch();
      else {
        const searchInput = document.querySelector('input[type="search"], input[name="q"], input#search');
        searchInput?.focus();
      }
      break;
    default:
      console.warn('Unknown media action:', actionName);
  }
}
