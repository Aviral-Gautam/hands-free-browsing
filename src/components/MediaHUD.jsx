// src/components/MediaHUD.jsx
import { useState, useEffect } from 'react';
import { executeMediaAction, YouTubeAdapter, getActiveVideoElement } from '../adapters/siteShortcuts';

export default function MediaHUD({ enabled = true }) {
  const [hasMedia, setHasMedia] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeFeedback, setActiveFeedback] = useState(null);
  const [isYT, setIsYT] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const checkMedia = () => {
      const onYouTube = YouTubeAdapter.isYouTube();
      setIsYT(onYouTube);
      const video = getActiveVideoElement();
      setHasMedia(Boolean(onYouTube || video));
    };

    const timer = setTimeout(checkMedia, 50);
    const interval = setInterval(checkMedia, 2000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [enabled]);

  const isVisible = enabled && hasMedia;
  if (!isVisible) return null;

  const handleAction = (actionName, label) => {
    executeMediaAction(actionName);
    setActiveFeedback(label);
    setTimeout(() => setActiveFeedback(null), 1200);
  };

  const buttons = [
    { id: 'togglePlay', label: '⏯ Play/Pause', shortcut: 'k' },
    { id: 'rewind', label: '⏪ -10s', shortcut: 'j' },
    { id: 'forward', label: '⏩ +10s', shortcut: 'l' },
    { id: 'toggleMute', label: '🔇 Mute', shortcut: 'm' },
    { id: 'toggleFullscreen', label: '⛶ Fullscreen', shortcut: 'f' }
  ];

  if (isYT) {
    buttons.push({ id: 'toggleCaptions', label: '💬 CC', shortcut: 'c' });
    buttons.push({ id: 'nextVideo', label: '⏭ Next', shortcut: 'Shift+N' });
  }

  buttons.push({ id: 'focusSearch', label: '🔍 Search', shortcut: '/' });

  return (
    <div
      style={{
        position: 'fixed',
        bottom: isMinimized ? '10px' : '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        zIndex: 9999995,
        pointerEvents: 'auto',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        userSelect: 'none'
      }}
    >
      {/* Floating feedback toast */}
      {activeFeedback && (
        <div
          style={{
            backgroundColor: '#10b981',
            color: '#ffffff',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          ✓ {activeFeedback}
        </div>
      )}

      {/* Dock Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(18, 18, 24, 0.92)',
          backdropFilter: 'blur(10px)',
          padding: '6px 12px',
          borderRadius: '30px',
          border: '1px solid rgba(168, 85, 247, 0.4)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45), 0 0 10px rgba(168, 85, 247, 0.25)'
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: '700',
            color: '#c084fc',
            paddingRight: '6px',
            borderRight: '1px solid rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          ▶ {isYT ? 'YouTube' : 'Media'}
        </span>

        {!isMinimized &&
          buttons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => handleAction(btn.id, btn.label)}
              title={`${btn.label} (${btn.shortcut})`}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '6px 10px',
                borderRadius: '16px',
                fontSize: '11px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(168, 85, 247, 0.35)';
                e.currentTarget.style.borderColor = '#c084fc';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {btn.label}
            </button>
          ))}

        <button
          onClick={() => setIsMinimized(!isMinimized)}
          title={isMinimized ? 'Expand Media Dock' : 'Minimize Media Dock'}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            fontSize: '11px',
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: '50%'
          }}
        >
          {isMinimized ? '⬆️' : '⬇️'}
        </button>
      </div>
    </div>
  );
}
