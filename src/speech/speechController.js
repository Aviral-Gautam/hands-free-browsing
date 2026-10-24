// src/speech/speechController.js
import { insertTextIntoField } from '../utils/domUtils';
import { executeMediaAction, YouTubeAdapter } from '../adapters/siteShortcuts';

export class SpeechController {
  constructor(options = {}) {
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onTranscript = options.onTranscript || (() => {});
    this.onCommand = options.onCommand || (() => {});

    this.recognition = null;
    this.isListening = false;
    this.isSupported = false;

    this.initRecognition();
  }

  initRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      this.isSupported = false;
      return;
    }

    this.isSupported = true;
    try {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.onStatusChange('listening');
      };

      this.recognition.onend = () => {
        // Auto-restart if still flagged listening (prevents timeout dropouts)
        if (this.isListening) {
          try {
            this.recognition.start();
          } catch {
            this.isListening = false;
            this.onStatusChange('idle');
          }
        } else {
          this.onStatusChange('idle');
        }
      };

      this.recognition.onerror = (event) => {
        console.debug('Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.isListening = false;
          this.onStatusChange('permission-denied');
        }
      };

      this.recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        const currentText = (finalTranscript || interimTranscript).trim();
        if (currentText) {
          this.onTranscript(currentText, Boolean(finalTranscript));
        }

        if (finalTranscript) {
          this.handleCommand(finalTranscript.trim().toLowerCase());
        }
      };
    } catch (e) {
      console.warn('SpeechRecognition initialization error:', e);
      this.isSupported = false;
    }
  }

  start() {
    if (!this.isSupported || !this.recognition) return false;
    if (this.isListening) return true;

    try {
      this.isListening = true;
      this.recognition.start();
      return true;
    } catch (e) {
      console.warn('Speech start failed:', e);
      this.isListening = false;
      return false;
    }
  }

  stop() {
    if (!this.recognition) return;
    this.isListening = false;
    try {
      this.recognition.stop();
    } catch {
      // ignore
    }
    this.onStatusChange('idle');
  }

  toggle() {
    if (this.isListening) {
      this.stop();
      return false;
    } else {
      return this.start();
    }
  }

  handleCommand(text) {
    const clean = text.toLowerCase().trim();

    // 1. Search commands ("search for...", "search ...")
    if (clean.startsWith('search for ') || clean.startsWith('search ')) {
      const query = clean.replace(/^search (for )?/, '').trim();
      if (query) {
        this.executeSearch(query);
        this.onCommand(`Search: "${query}"`);
        return;
      }
    }

    // 2. Media Controls
    if (clean === 'play' || clean === 'pause' || clean === 'play video' || clean === 'pause video') {
      executeMediaAction('togglePlay');
      this.onCommand('Toggle Play/Pause');
      return;
    }

    if (clean === 'rewind' || clean === 'skip back' || clean === 'go back 10 seconds') {
      executeMediaAction('rewind');
      this.onCommand('Rewind 10s');
      return;
    }

    if (clean === 'forward' || clean === 'skip forward' || clean === 'fast forward') {
      executeMediaAction('forward');
      this.onCommand('Forward 10s');
      return;
    }

    if (clean === 'mute' || clean === 'unmute' || clean === 'toggle sound') {
      executeMediaAction('toggleMute');
      this.onCommand('Toggle Mute');
      return;
    }

    if (clean === 'fullscreen' || clean === 'full screen') {
      executeMediaAction('toggleFullscreen');
      this.onCommand('Toggle Fullscreen');
      return;
    }

    if (clean === 'next' || clean === 'next video') {
      executeMediaAction('nextVideo');
      this.onCommand('Next Video');
      return;
    }

    // 3. Navigation Controls
    if (clean === 'scroll down' || clean === 'down') {
      window.scrollBy({ top: 400, behavior: 'smooth' });
      this.onCommand('Scroll Down');
      return;
    }

    if (clean === 'scroll up' || clean === 'up') {
      window.scrollBy({ top: -400, behavior: 'smooth' });
      this.onCommand('Scroll Up');
      return;
    }

    if (clean === 'go top' || clean === 'scroll to top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.onCommand('Top of Page');
      return;
    }

    // 4. Form and Input Commands
    if (clean === 'enter' || clean === 'submit') {
      const active = document.activeElement;
      if (active) {
        active.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        this.onCommand('Press Enter');
      }
      return;
    }

    if (clean === 'clear' || clean === 'clear input') {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        insertTextIntoField(active, '', false);
        this.onCommand('Clear Text');
      }
      return;
    }

    // 5. Dictation into Active Input Field
    const active = document.activeElement;
    if (
      active &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)
    ) {
      insertTextIntoField(active, text + ' ', false);
      this.onCommand(`Dictated: "${text}"`);
      return;
    }

    // Unhandled speech
    this.onCommand(`Spoken: "${text}"`);
  }

  executeSearch(query) {
    if (YouTubeAdapter.isYouTube()) {
      const ytInput = document.querySelector('ytd-searchbox input#search') ||
        document.querySelector('input[name="search_query"]') ||
        document.querySelector('input#search');

      if (ytInput) {
        insertTextIntoField(ytInput, query, true);
        const searchBtn = document.querySelector('button#search-icon-legacy');
        searchBtn?.click();
        return;
      }
    }

    // Generic search input detection
    const searchInputs = Array.from(
      document.querySelectorAll('input[type="search"], input[name="q"], input[name="query"], input[placeholder*="search" i]')
    );

    if (searchInputs.length > 0) {
      insertTextIntoField(searchInputs[0], query, true);
      return;
    }

    // Fallback: search on current site or YouTube
    if (YouTubeAdapter.isYouTube()) {
      window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    } else {
      window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    }
  }
}
