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
import EdgeNavigator from './components/EdgeNavigator';
import MediaHUD from './components/MediaHUD';
import VoiceHUD from './components/VoiceHUD';
import OnscreenHUD from './components/OnscreenHUD';
import { SpeechController } from './speech/speechController';
import { executeMediaAction } from './adapters/siteShortcuts';

// Helper to get current viewport dimensions (always fresh)
function getViewport() {
  return { w: window.innerWidth, h: window.innerHeight };
}

// ─── Tuning constants ────────────────────────────────────────────────────────

// 2.0 = 100% gain over the original head-to-screen mapping.
const HEAD_SENSITIVITY = 2.0;

const DWELL_DURATION_MS = 1700;
// Grace period after the cursor settles on a new target before the dwell
// countdown starts. Prevents accidental clicks while passing over elements.
const HOVER_CLICK_DELAY_MS = 300;
// Total time from first hovering a target to the auto-click: 2 seconds.
// (HOVER_CLICK_DELAY_MS + DWELL_DURATION_MS)

// Edge navigation (browser back / forward)
const EDGE_ZONE_RATIO = 0.035; // 3.5% of viewport width
const EDGE_ZONE_MIN_PX = 28;
const EDGE_NAV_HOLD_MS = 900;
const EDGE_NAV_COOLDOWN_MS = 1500;

// Disengage mode (long blink)
const EYES_CLOSED_THRESHOLD = 0.6;
const DISENGAGE_HOLD_MS = 1500;
const DISENGAGE_TOGGLE_GUARD_MS = 700;

// Double blink (play / pause)
const DOUBLE_BLINK_MAX_MS = 450; // each blink must be shorter than this
const DOUBLE_BLINK_GAP_MS = 650; // max gap between the two blinks
const DOUBLE_BLINK_COOLDOWN_MS = 1200;

// Gesture thresholds
const WINK_CLICK_THRESHOLD = 0.6;
const BROW_SCROLL_UP_THRESHOLD = 0.55;
const SMILE_MUTE_THRESHOLD = 0.65;
const JAW_SCROLL_DOWN_THRESHOLD = 0.35; // lowered for an easier scroll-down trigger

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
  const [isSettling, setIsSettling] = useState(false);
  const dwellStartTime = useRef(null);
  const dwellTargetEl = useRef(null);
  const hoverSettleStart = useRef(null);

  // Disengage mode (long blink) state
  const [isDisengaged, setIsDisengaged] = useState(false);
  const [disengageProgress, setDisengageProgress] = useState(0);
  const isDisengagedRef = useRef(false);
  const eyesClosedSince = useRef(null);
  const requireEyesOpen = useRef(false);
  const lastDisengageToggle = useRef(0);

  // Double blink (play / pause) state
  const eyesWereClosed = useRef(false);
  const blinkStartedAt = useRef(0);
  const lastBlinkEndAt = useRef(0);
  const lastDoubleBlinkAt = useRef(0);

  // Edge navigation state
  const [edgeNav, setEdgeNav] = useState(null); // { side, progress, fired }
  const edgeSideRef = useRef(null);
  const edgeHoldStart = useRef(null);
  const lastEdgeNavTime = useRef(0);
  // Latch so a single continuous hold fires only once; leave the edge to re-arm.
  const edgeArmedRef = useRef(true);


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

  // Keep the ref in sync so the high-frequency FACE_DATA handler can read the
  // disengage flag without being re-subscribed on every state change.
  useEffect(() => {
    isDisengagedRef.current = isDisengaged;
  }, [isDisengaged]);

  // Clear every dwell / click timer. Used on click, target loss and disengage.
  const resetDwell = useCallback(() => {
    dwellTargetEl.current = null;
    dwellStartTime.current = null;
    hoverSettleStart.current = null;
    setDwellProgress(0);
    setIsDwellComplete(false);
    setIsSettling(false);
  }, []);

  // Enter / leave disengage mode (long blink). The ref is updated synchronously
  // so the same FACE_DATA frame that triggers the toggle already respects it.
  const setDisengaged = useCallback((next) => {
    isDisengagedRef.current = next;
    setIsDisengaged(next);
    resetDwell();
    setEdgeNav(null);
    edgeSideRef.current = null;
    edgeHoldStart.current = null;
    edgeArmedRef.current = true;

    if (next) {
      setHighlightTarget(null);
      setTargetInfo(null);
      setIsSnapping(false);
      setDisengageProgress(0);
    }
  }, [resetDwell]);

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
    if (isHeadTrackingStreaming && !isDisengaged) {
      hideNativeCursor();
    } else {
      showNativeCursor();
    }
  }, [isHeadTrackingStreaming, isDisengaged, hideNativeCursor, showNativeCursor]);

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
          if (typeof res.disengaged === 'boolean') {
            setDisengaged(res.disengaged);
          }
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
  }, [setDisengaged]);

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
    // Never click while disengaged (eyes-closed / pause mode)
    if (isDisengagedRef.current) return;

    setIsClicking(true);
    setTimeout(() => setIsClicking(false), 300);

    // Reset any active dwell so a gesture-click doesn't double-fire with a pending dwell
    resetDwell();

    // Find the interactive target on the host page (pointer-events: none on our container
    // ensures elementFromPoint sees through us)
    const match = findNearbyInteractiveTarget(x, y, 40);
    const targetEl = match?.element || document.elementFromPoint(x, y);

    if (targetEl) {
      dispatchPointerEventSequence(targetEl, x, y);
    }
  }, [resetDwell]);

  // Core element evaluation, edge navigation & magnetic snap logic.
  // `allowEdgeNav` is only enabled for head tracking, so a physical mouse parked
  // at the very edge of the window can never navigate unexpectedly.
  // `suppressClick` freezes clicks while both eyes are closed (long-blink input).
  const processCoordinates = useCallback((rawX, rawY, allowEdgeNav = false, suppressClick = false) => {
    const { w, h } = getViewport();
    const now = Date.now();
    const cursorX = Math.max(0, Math.min(w, rawX));
    const cursorY = Math.max(0, Math.min(h, rawY));
    let finalX = cursorX;
    let finalY = cursorY;

    // Proximity Radar: scans 45px radius for interactive elements & web components
    const match = findNearbyInteractiveTarget(cursorX, cursorY, 45);

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

      // Dwell Clicking logic with a settle delay so merely passing over a
      // target never triggers a click.
      if (isDisengagedRef.current) {
        resetDwell();
      } else if (dwellTargetEl.current === element) {
        if (dwellStartTime.current === null) {
          if (hoverSettleStart.current === null) hoverSettleStart.current = now;
          if (now - hoverSettleStart.current >= HOVER_CLICK_DELAY_MS) {
            dwellStartTime.current = now;
            setIsSettling(false);
          } else {
            setIsSettling(true);
          }
        }

        if (dwellStartTime.current !== null) {
          const elapsed = now - dwellStartTime.current;
          const progress = Math.min(100, Math.round((elapsed / DWELL_DURATION_MS) * 100));
          setDwellProgress(progress);

          if (elapsed >= DWELL_DURATION_MS && !suppressClick) {
            executeClick(finalX, finalY);
            setIsDwellComplete(true);
            setTimeout(() => {
              setDwellProgress(0);
              setIsDwellComplete(false);
            }, 400);
          } else if (elapsed >= DWELL_DURATION_MS && suppressClick) {
            // Both eyes are closed — abandon the dwell instead of clicking so a
            // deliberate long blink can never fire an accidental click.
            resetDwell();
          }
        }
      } else {
        // New target: restart the settle delay, don't start dwelling yet
        dwellTargetEl.current = element;
        hoverSettleStart.current = now;
        dwellStartTime.current = null;
        setDwellProgress(0);
        setIsDwellComplete(false);
        setIsSettling(true);
      }
    } else {
      setHighlightTarget(null);
      setTargetInfo(null);
      resetDwell();
    }

    // ─── Edge navigation (history back / forward) ───
    // Evaluated after snapping: if the cursor is magnetically attached to a
    // real target (e.g. a sidebar button inside the edge strip), that target
    // wins and no navigation is triggered.
    let activeEdge = null;
    if (allowEdgeNav && !isDisengagedRef.current && !snapped) {
      const edgeWidth = Math.max(EDGE_ZONE_MIN_PX, Math.round(w * EDGE_ZONE_RATIO));
      if (cursorX <= edgeWidth) activeEdge = 'left';
      else if (cursorX >= w - edgeWidth) activeEdge = 'right';
    }

    if (activeEdge) {
      if (edgeSideRef.current !== activeEdge) {
        edgeSideRef.current = activeEdge;
        edgeHoldStart.current = now;
        edgeArmedRef.current = true;
      } else if (edgeHoldStart.current === null) {
        edgeHoldStart.current = now;
      }

      const held = now - edgeHoldStart.current;
      const canFire = edgeArmedRef.current && now - lastEdgeNavTime.current > EDGE_NAV_COOLDOWN_MS;

      if (held >= EDGE_NAV_HOLD_MS && canFire) {
        edgeArmedRef.current = false; // require leaving the edge before re-firing
        lastEdgeNavTime.current = now;
        edgeHoldStart.current = now;
        setEdgeNav({ side: activeEdge, progress: 100, fired: true });
        if (activeEdge === 'left') window.history.back();
        else window.history.forward();
      } else {
        setEdgeNav({
          side: activeEdge,
          progress: Math.min(100, Math.round((held / EDGE_NAV_HOLD_MS) * 100)),
          fired: false
        });
      }
    } else if (edgeSideRef.current !== null) {
      edgeSideRef.current = null;
      edgeHoldStart.current = null;
      edgeArmedRef.current = true;
      setEdgeNav(null);
    }

    setIsSnapping(snapped);
    setPosition({ x: finalX, y: finalY });

    // Throttled hover move dispatching for tooltips and video player controls
    if (now - lastHoverTime.current > 40) {
      const hovered = match?.element || document.elementFromPoint(finalX, finalY);
      if (hovered) {
        dispatchHoverMove(hovered, finalX, finalY);
      }
      lastHoverTime.current = now;
    }
  }, [executeClick, resetDwell]);

  // 1. Listen for background & tracker messages
  useEffect(() => {
    const handleMessage = (message) => {
      if (message.type === 'TRACKER_STATUS_CHANGED') {
        setIsTrackingActive(Boolean(message.active));
        if (typeof message.disengaged === 'boolean') {
          setDisengaged(message.disengaged);
        }
        if (!message.active) {
          setIsHeadTrackingStreaming(false);
        }
        return;
      }

      if (message.type === 'DISENGAGE_CHANGED') {
        setDisengaged(Boolean(message.disengaged));
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

        const now = Date.now();

        // ─── Long blink (both eyes closed ~1.5s) → disengage toggle ───
        const eyesClosed =
          leftWink > EYES_CLOSED_THRESHOLD && rightWink > EYES_CLOSED_THRESHOLD;

        if (eyesClosed && !requireEyesOpen.current) {
          if (eyesClosedSince.current === null) eyesClosedSince.current = now;
          const held = now - eyesClosedSince.current;
          setDisengageProgress(
            Math.min(100, Math.round((held / DISENGAGE_HOLD_MS) * 100))
          );

          if (held >= DISENGAGE_HOLD_MS && now - lastDisengageToggle.current > DISENGAGE_TOGGLE_GUARD_MS) {
            lastDisengageToggle.current = now;
            eyesClosedSince.current = null;
            // Require the eyes to open again before another toggle, otherwise a
            // user who keeps their eyes shut would flip the mode every 1.5s.
            requireEyesOpen.current = true;
            setDisengageProgress(0);

            const next = !isDisengagedRef.current;
            setDisengaged(next);
            // Share the mode with every other tab through the background hub.
            try {
              chrome.runtime.sendMessage({ type: 'DISENGAGE_CHANGED', disengaged: next })?.catch?.(() => {});
            } catch {
              // ignore messaging failures
            }
          }
        } else {
          // Only re-arm once the eyes are actually open again.
          if (!eyesClosed) requireEyesOpen.current = false;
          eyesClosedSince.current = null;
          setDisengageProgress(0);
        }

        // ─── Double blink (two short both-eye blinks) → Play / Pause ───
        if (eyesClosed && !eyesWereClosed.current) {
          eyesWereClosed.current = true;
          blinkStartedAt.current = now;
        } else if (!eyesClosed && eyesWereClosed.current) {
          eyesWereClosed.current = false;
          const blinkDuration = now - blinkStartedAt.current;
          const gap = now - lastBlinkEndAt.current;
          const isShortBlink = blinkDuration <= DOUBLE_BLINK_MAX_MS;

          if (
            isShortBlink &&
            lastBlinkEndAt.current > 0 &&
            gap <= DOUBLE_BLINK_GAP_MS &&
            now - lastDoubleBlinkAt.current > DOUBLE_BLINK_COOLDOWN_MS &&
            !isDisengagedRef.current
          ) {
            lastDoubleBlinkAt.current = now;
            lastBlinkEndAt.current = 0;
            executeMediaAction('togglePlay');
            lastActionTime.current = now;
          } else {
            lastBlinkEndAt.current = isShortBlink ? now : 0;
          }
        }

        // While disengaged: freeze the cursor and ignore every gesture.
        if (isDisengagedRef.current) return;

        const { w, h } = getViewport();

        // Head-to-screen mapping with sensitivity gain applied around the
        // calibrated centre (0.5), then mirror-inverted on X.
        const nx = 0.5 + (x - 0.5) * HEAD_SENSITIVITY;
        const ny = 0.5 + (y - 0.5) * 1.5 * HEAD_SENSITIVITY;
        const targetX = (1 - nx) * w;
        const targetY = ny * h;

        // Micro-deadzone & Adaptive EMA Smoothing
        const deltaX = Math.abs(targetX - smoothedPos.current.x);
        const deltaY = Math.abs(targetY - smoothedPos.current.y);
        const distanceDelta = Math.hypot(deltaX, deltaY);

        if (distanceDelta > 1.8) {
          const alpha = distanceDelta > 45 ? 0.26 : 0.14;
          smoothedPos.current.x += alpha * (targetX - smoothedPos.current.x);
          smoothedPos.current.y += alpha * (targetY - smoothedPos.current.y);
        }

        // Head tracking is the only source allowed to trigger edge navigation.
        // Eyes-closed frames may neither navigate nor click.
        processCoordinates(
          smoothedPos.current.x,
          smoothedPos.current.y,
          !eyesClosed,
          eyesClosed
        );

        // Gestures to Browser Actions (800ms debounce).
        // Suppressed while both eyes are closed so a long blink never clicks.
        if (eyesClosed) return;

        if (now - lastActionTime.current > 800) {
          if (leftWink > WINK_CLICK_THRESHOLD) {
            executeClick(smoothedPos.current.x, smoothedPos.current.y);
            lastActionTime.current = now;
          } else if (browInnerUp > BROW_SCROLL_UP_THRESHOLD) {
            window.scrollBy({ top: -350, behavior: 'smooth' });
            lastActionTime.current = now;
          } else if (mouthSmile > SMILE_MUTE_THRESHOLD) {
            executeMediaAction('toggleMute');
            lastActionTime.current = now;
          } else if (rightWink > WINK_CLICK_THRESHOLD) {
            window.scrollBy({ top: -350, behavior: 'smooth' });
            lastActionTime.current = now;
          } else if (jawOpen > JAW_SCROLL_DOWN_THRESHOLD) {
            window.scrollBy({ top: 350, behavior: 'smooth' });
            lastActionTime.current = now;
          }
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [processCoordinates, executeClick, setDisengaged]);

  // 2. Mouse / Pointer Fallback when Head Tracking is in Standby
  useEffect(() => {
    const handlePointerMove = (e) => {
      // If active head tracking stream is running, ignore native mouse moves
      if (isHeadTrackingStreaming || isDisengagedRef.current) return;

      smoothedPos.current.x = e.clientX;
      smoothedPos.current.y = e.clientY;
      processCoordinates(e.clientX, e.clientY, false);
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
        isDisengaged={isDisengaged}
        disengageProgress={disengageProgress}
        onToggleTracker={handleToggleTracker}
      />

      {/* Dynamic Web Component & Interactive Element Highlight Halo */}
      <ElementHighlighter rect={highlightTarget} info={targetInfo} isSnapping={isSnapping} />

      {/* Back / Forward zone feedback on the screen edges */}
      <EdgeNavigator
        side={isDisengaged ? null : edgeNav?.side}
        progress={edgeNav?.progress || 0}
        fired={edgeNav?.fired || false}
      />

      {/* Circular Dwell Progress Ring */}
      <DwellIndicator
        x={position.x}
        y={position.y}
        progress={dwellProgress}
        isComplete={isDwellComplete}
        isSettling={isSettling}
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
          opacity: isDisengaged ? 0 : 1,
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
          opacity: isDisengaged ? 0 : 1,
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
          backgroundColor: isDisengaged
            ? 'rgba(51, 65, 85, 0.9)'
            : isSnapping
            ? 'rgba(2, 132, 199, 0.9)'
            : isHeadTrackingStreaming
            ? 'rgba(126, 34, 206, 0.85)'
            : 'rgba(30, 41, 59, 0.85)',
          border: isDisengaged
            ? '1px solid #94a3b8'
            : isSnapping
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
        {isDisengaged
          ? '😴 Disengaged'
          : isSnapping
          ? '🎯 Snapped'
          : isHeadTrackingStreaming
          ? '👁️ Head Tracking'
          : '💤 Standby'}
      </div>
    </>
  );
}
