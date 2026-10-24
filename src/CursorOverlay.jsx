// src/CursorOverlay.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  findNearbyInteractiveTarget,
  getElementDescription,
  dispatchPointerEventSequence,
  dispatchHoverMove
} from './utils/domUtils';
import ElementHighlighter from './components/ElementHighlighter';
import DwellIndicator from './components/DwellIndicator';
import MediaHUD from './components/MediaHUD';
import VoiceHUD from './components/VoiceHUD';
import OnscreenHUD from './components/OnscreenHUD';
import { SpeechController } from './speech/speechController';
import { executeMediaAction } from './adapters/siteShortcuts';

// Helper to get current viewport dimensions (always fresh)
function getViewport() {
  return { w: window.innerWidth, h: window.innerHeight };
}

export default function CursorOverlay() {
  console.log('CursorOverlay rendered');
  const { w: initW, h: initH } = getViewport();
  const [position, setPosition] = useState({ x: initW / 2, y: initH / 2 });
  const [isClicking, setIsClicking] = useState(false);
  const [highlightTarget, setHighlightTarget] = useState(null);
  const [targetInfo, setTargetInfo] = useState(null);
  const [isSnapping, setIsSnapping] = useState(false);

  // Tracking state
  const [isTrackingActive, setIsTrackingActive] = useState(false);
  const [isHeadTrackingStreaming, setIsHeadTrackingStreaming] = useState(false);
  const lastFaceDataTimestamp = useRef(0);

  // Dwell click state
  const [dwellProgress, setDwellProgress] = useState(0);
  const [isDwellComplete, setIsDwellComplete] = useState(false);
  const dwellStartTime = useRef(null);
  const dwellTargetEl = useRef(null);
  const DWELL_DURATION_MS = 1000;

  // Voice HUD state
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('idle');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [lastVoiceCommand, setLastVoiceCommand] = useState(null);
  const [isSpeechSupported] = useState(() =>
    typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
  const speechCtrl = useRef(null);

  // Coordinate smoothing refs
  const smoothedPos = useRef({ x: initW / 2, y: initH / 2 });
  const lastActionTime = useRef(0);
  const lastHoverTime = useRef(0);

  // Native cursor hiding state
  const nativeCursorHidden = useRef(false);

  // ─── Native cursor management ──────────────────────────────────────────────
  // When head-tracking is active, hide the OS/browser native cursor so only our
  // custom overlay cursor is visible. Restore it when tracking stops or unmounts.
  const hideNativeCursor = useCallback(() => {
    if (!nativeCursorHidden.current) {
      document.documentElement.style.setProperty('cursor', 'none', 'important');
      document.body.style.setProperty('cursor', 'none', 'important');
      nativeCursorHidden.current = true;
    }
  }, []);

  const showNativeCursor = useCallback(() => {
    if (nativeCursorHidden.current) {
      document.documentElement.style.removeProperty('cursor');
      document.body.style.removeProperty('cursor');
      nativeCursorHidden.current = false;
    }
  }, []);

  useEffect(() => {
    if (isHeadTrackingStreaming) {
      hideNativeCursor();
    } else {
      showNativeCursor();
    }
  }, [isHeadTrackingStreaming, hideNativeCursor, showNativeCursor]);

  // Restore native cursor on unmount
  useEffect(() => {
    return () => showNativeCursor();
  }, [showNativeCursor]);

  // ─── Viewport resize handling ──────────────────────────────────────────────
  // When the browser window is resized, re-clamp the cursor position and update
  // the smoothed position ref so coordinates don't go off-screen.
  useEffect(() => {
    const handleResize = () => {
      const { w, h } = getViewport();
      setPosition(prev => ({
        x: Math.max(0, Math.min(w, prev.x)),
        y: Math.max(0, Math.min(h, prev.y))
      }));
      smoothedPos.current = {
        x: Math.max(0, Math.min(w, smoothedPos.current.x)),
        y: Math.max(0, Math.min(h, smoothedPos.current.y))
      };
    };

    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check tracker status from background on mount
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_TRACKER_STATUS' }, (res) => {
        if (res) {
          setIsTrackingActive(Boolean(res.active));
        }
      });
    }

    // Monitor if head tracking data stream stops (fallback to mouse after 1.8s of no face data)
    const watchdog = setInterval(() => {
      const now = Date.now();
      if (lastFaceDataTimestamp.current > 0 && now - lastFaceDataTimestamp.current > 1800) {
        setIsHeadTrackingStreaming(false);
      }
    }, 1000);

    return () => clearInterval(watchdog);
  }, []);

  // Initialize Speech Controller
  useEffect(() => {
    const ctrl = new SpeechController({
      onStatusChange: (status) => {
        setVoiceStatus(status);
        setVoiceListening(status === 'listening');
      },
      onTranscript: (transcript) => {
        setVoiceTranscript(transcript);
      },
      onCommand: (command) => {
        setLastVoiceCommand(command);
        setTimeout(() => setLastVoiceCommand(null), 2500);
      }
    });

    speechCtrl.current = ctrl;

    return () => {
      ctrl.stop();
    };
  }, []);

  const handleToggleMic = useCallback(() => {
    if (speechCtrl.current) {
      speechCtrl.current.toggle();
    }
  }, []);

  const handleToggleTracker = useCallback(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'TOGGLE_TRACKER' }, (res) => {
        if (res) {
          setIsTrackingActive((prev) => !prev);
        }
      });
    }
  }, []);

  // Execute full synthetic click sequence on the real page (not inside our overlay)
  const executeClick = useCallback((x, y) => {
    setIsClicking(true);
    setTimeout(() => setIsClicking(false), 300);

    // Reset any active dwell so a gesture-click doesn't double-fire with a pending dwell
    dwellTargetEl.current = null;
    dwellStartTime.current = null;
    setDwellProgress(0);
    setIsDwellComplete(false);

    // Find the interactive target on the host page (pointer-events: none on our container
    // ensures elementFromPoint sees through us)
    const match = findNearbyInteractiveTarget(x, y, 40);
    const targetEl = match?.element || document.elementFromPoint(x, y);

    if (targetEl) {
      dispatchPointerEventSequence(targetEl, x, y);
    }
  }, []);

  // Core element evaluation & magnetic snap logic
  const processCoordinates = useCallback((rawX, rawY) => {
    const { w, h } = getViewport();
    let finalX = Math.max(0, Math.min(w, rawX));
    let finalY = Math.max(0, Math.min(h, rawY));

    // Proximity Radar: scans 45px radius for interactive elements & web components
    const match = findNearbyInteractiveTarget(finalX, finalY, 45);

    let snapped = false;
    if (match && match.element) {
      const { element, rect, distance } = match;
      setHighlightTarget(rect);
      setTargetInfo(getElementDescription(element));

      // Magnetic Snapping: gently attract cursor to element center
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      if (distance < 45) {
        finalX += (centerX - finalX) * 0.45;
        finalY += (centerY - finalY) * 0.45;
        snapped = true;
      }

      // Dwell Clicking logic
      if (dwellTargetEl.current === element) {
        if (dwellStartTime.current) {
          const elapsed = Date.now() - dwellStartTime.current;
          const progress = Math.min(100, Math.round((elapsed / DWELL_DURATION_MS) * 100));
          setDwellProgress(progress);

          if (elapsed >= DWELL_DURATION_MS) {
            setIsDwellComplete(true);
            executeClick(finalX, finalY);
            dwellStartTime.current = null;
            dwellTargetEl.current = null;
            setTimeout(() => {
              setDwellProgress(0);
              setIsDwellComplete(false);
            }, 400);
          }
        }
      } else {
        dwellTargetEl.current = element;
        dwellStartTime.current = Date.now();
        setDwellProgress(0);
        setIsDwellComplete(false);
      }
    } else {
      setHighlightTarget(null);
      setTargetInfo(null);
      dwellTargetEl.current = null;
      dwellStartTime.current = null;
      setDwellProgress(0);
      setIsDwellComplete(false);
    }

    setIsSnapping(snapped);
    setPosition({ x: finalX, y: finalY });

    // Throttled hover move dispatching for tooltips and video player controls
    const now = Date.now();
    if (now - lastHoverTime.current > 40) {
      const hovered = match?.element || document.elementFromPoint(finalX, finalY);
      if (hovered) {
        dispatchHoverMove(hovered, finalX, finalY);
      }
      lastHoverTime.current = now;
    }
  }, [executeClick]);

  // 1. Listen for background & tracker messages
  useEffect(() => {
    const handleMessage = (message) => {
      if (message.type === 'TRACKER_STATUS_CHANGED') {
        setIsTrackingActive(Boolean(message.active));
        if (!message.active) {
          setIsHeadTrackingStreaming(false);
        }
        return;
      }

      if (message.type === 'FACE_DATA') {
        lastFaceDataTimestamp.current = Date.now();
        setIsHeadTrackingStreaming(true);
        setIsTrackingActive(true);

        const {
          x,
          y,
          leftWink,
          rightWink,
          jawOpen,
          browInnerUp = 0,
          mouthSmile = 0
        } = message.data;

        const { w, h } = getViewport();

        // Screen coordinate mapping (mirror inversion on X)
        const targetX = (1 - x) * w;
        const targetY = (y * 1.5 - 0.25) * h;

        // Micro-deadzone & Adaptive EMA Smoothing
        const deltaX = Math.abs(targetX - smoothedPos.current.x);
        const deltaY = Math.abs(targetY - smoothedPos.current.y);
        const distanceDelta = Math.hypot(deltaX, deltaY);

        if (distanceDelta > 1.8) {
          const alpha = distanceDelta > 45 ? 0.26 : 0.14;
          smoothedPos.current.x += alpha * (targetX - smoothedPos.current.x);
          smoothedPos.current.y += alpha * (targetY - smoothedPos.current.y);
        }

        processCoordinates(smoothedPos.current.x, smoothedPos.current.y);

        // Gestures to Browser Actions (800ms debounce)
        const now = Date.now();
        if (now - lastActionTime.current > 800) {
          if (leftWink > 0.6) {
            executeClick(smoothedPos.current.x, smoothedPos.current.y);
            lastActionTime.current = now;
          } else if (browInnerUp > 0.55) {
            executeMediaAction('togglePlay');
            lastActionTime.current = now;
          } else if (mouthSmile > 0.65) {
            executeMediaAction('toggleMute');
            lastActionTime.current = now;
          } else if (rightWink > 0.6) {
            window.scrollBy({ top: -350, behavior: 'smooth' });
            lastActionTime.current = now;
          } else if (jawOpen > 0.5) {
            window.scrollBy({ top: 350, behavior: 'smooth' });
            lastActionTime.current = now;
          }
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [processCoordinates, executeClick]);

  // 2. Mouse / Pointer Fallback when Head Tracking is in Standby
  useEffect(() => {
    const handlePointerMove = (e) => {
      // If active head tracking stream is running, ignore native mouse moves
      if (isHeadTrackingStreaming) return;

      smoothedPos.current.x = e.clientX;
      smoothedPos.current.y = e.clientY;
      processCoordinates(e.clientX, e.clientY);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [isHeadTrackingStreaming, processCoordinates]);

  return (
    <>
      <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.9; }
          50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
        }
        @keyframes clickRipple {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
        }
      `}</style>

      {/* On-Screen Status HUD & Quick Tracker Toggle */}
      <OnscreenHUD
        isTrackingActive={isTrackingActive}
        isHeadTrackingStreaming={isHeadTrackingStreaming}
        onToggleTracker={handleToggleTracker}
      />

      {/* Dynamic Web Component & Interactive Element Highlight Halo */}
      <ElementHighlighter rect={highlightTarget} info={targetInfo} isSnapping={isSnapping} />

      {/* Circular Dwell Progress Ring */}
      <DwellIndicator
        x={position.x}
        y={position.y}
        progress={dwellProgress}
        isComplete={isDwellComplete}
      />

      {/* Floating Hands-Free Media Dock (YouTube & HTML5 Video) */}
      <MediaHUD enabled={true} />

      {/* Voice Dictation & Search Status Bar */}
      <VoiceHUD
        isListening={voiceListening}
        status={voiceStatus}
        transcript={voiceTranscript}
        lastCommand={lastVoiceCommand}
        onToggleMic={handleToggleMic}
        isSupported={isSpeechSupported}
      />

      {/* Click Ripple Animation */}
      {isClicking && (
        <div
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(34, 197, 94, 0.65) 0%, rgba(34, 197, 94, 0) 70%)',
            border: '2.5px solid #22c55e',
            animation: 'clickRipple 0.35s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 2147483646
          }}
        />
      )}

      {/* High-Visibility Onscreen Cursor: Outer Glowing Ring */}
      <div
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: isClicking ? '36px' : isSnapping ? '32px' : '28px',
          height: isClicking ? '36px' : isSnapping ? '32px' : '28px',
          borderRadius: '50%',
          border: isClicking
            ? '2.5px solid #22c55e'
            : isSnapping
            ? '2.5px solid #38bdf8'
            : '2px solid #ffffff',
          backgroundColor: isClicking
            ? 'rgba(34, 197, 94, 0.3)'
            : isSnapping
            ? 'rgba(56, 189, 248, 0.25)'
            : 'rgba(168, 85, 247, 0.2)',
          boxShadow: isClicking
            ? '0 0 20px #22c55e, inset 0 0 10px #22c55e'
            : isSnapping
            ? '0 0 18px #38bdf8, inset 0 0 8px #38bdf8'
            : '0 0 14px rgba(168, 85, 247, 0.8), 0 2px 6px rgba(0,0,0,0.6)',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 2147483647,
          transition: 'width 0.15s, height 0.15s, border-color 0.15s, box-shadow 0.15s'
        }}
      />

      {/* Inner Center Reticle Dot */}
      <div
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isClicking
            ? '#22c55e'
            : isSnapping
            ? '#38bdf8'
            : '#ffffff',
          boxShadow: '0 0 6px rgba(0,0,0,0.8)',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 2147483647
        }}
      />

      {/* Cursor Status Tag Pill */}
      <div
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y + 24}px`,
          transform: 'translateX(-50%)',
          padding: '2px 7px',
          borderRadius: '10px',
          fontSize: '9.5px',
          fontWeight: '700',
          letterSpacing: '0.3px',
          color: '#ffffff',
          backgroundColor: isSnapping
            ? 'rgba(2, 132, 199, 0.9)'
            : isHeadTrackingStreaming
            ? 'rgba(126, 34, 206, 0.85)'
            : 'rgba(30, 41, 59, 0.85)',
          border: isSnapping
            ? '1px solid #38bdf8'
            : isHeadTrackingStreaming
            ? '1px solid #c084fc'
            : '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 2147483647,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}
      >
        {isSnapping ? '🎯 Snapped' : isHeadTrackingStreaming ? '👁️ Head Tracking' : '💤 Standby'}
      </div>
    </>
  );
}
