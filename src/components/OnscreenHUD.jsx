// src/components/OnscreenHUD.jsx
import { useState } from 'react';

export default function OnscreenHUD({
  isTrackingActive,
  isHeadTrackingStreaming,
  isDisengaged = false,
  disengageProgress = 0,
  onToggleTracker
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        left: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(15, 15, 22, 0.94)',
        backdropFilter: 'blur(10px)',
        padding: '5px 10px',
        borderRadius: '24px',
        border: isDisengaged
          ? '1.5px solid #64748b'
          : isHeadTrackingStreaming
          ? '1.5px solid #22c55e'
          : isTrackingActive
          ? '1.5px solid #eab308'
          : '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: isHeadTrackingStreaming && !isDisengaged
          ? '0 0 16px rgba(34, 197, 94, 0.4), 0 4px 16px rgba(0,0,0,0.5)'
          : '0 4px 16px rgba(0,0,0,0.4)',
        zIndex: 2147483645,
        pointerEvents: 'auto',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        userSelect: 'none',
        fontSize: '11px',
        color: '#f8fafc',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Status Indicator Dot */}
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isDisengaged
            ? '#64748b'
            : isHeadTrackingStreaming
            ? '#22c55e'
            : isTrackingActive
            ? '#eab308'
            : '#64748b',
          boxShadow: isHeadTrackingStreaming && !isDisengaged ? '0 0 8px #22c55e' : 'none'
        }}
      />

      <span style={{ fontWeight: '700', letterSpacing: '0.3px', color: '#e2e8f0' }}>
        Hands-Free
      </span>

      {!isCollapsed && (
        <>
          <span
            style={{
              padding: '2px 6px',
              borderRadius: '10px',
              fontSize: '10px',
              fontWeight: '600',
              textTransform: 'uppercase',
              backgroundColor: isDisengaged
                ? 'rgba(148, 163, 184, 0.2)'
                : isHeadTrackingStreaming
                ? 'rgba(34, 197, 94, 0.2)'
                : 'rgba(255, 255, 255, 0.1)',
              color: isDisengaged
                ? '#cbd5e1'
                : isHeadTrackingStreaming
                ? '#86efac'
                : '#94a3b8'
            }}
          >
            {isDisengaged
              ? 'Disengaged'
              : isHeadTrackingStreaming
              ? 'Head Track'
              : 'Mouse Fallback'}
          </span>

          {(isDisengaged || disengageProgress > 0) && (
            <span
              style={{
                padding: '2px 6px',
                borderRadius: '10px',
                fontSize: '10px',
                fontWeight: '700',
                backgroundColor: disengageProgress > 0
                  ? 'rgba(34, 197, 94, 0.22)'
                  : 'rgba(168, 85, 247, 0.22)',
                color: disengageProgress > 0 ? '#86efac' : '#d8b4fe',
                border: disengageProgress > 0
                  ? '1px solid rgba(34, 197, 94, 0.6)'
                  : '1px solid rgba(168, 85, 247, 0.45)'
              }}
            >
              {isDisengaged
                ? disengageProgress > 0
                  ? `Resuming ${Math.round(disengageProgress)}%`
                  : 'Long blink 1.5s to resume'
                : `Closing eyes ${Math.round(disengageProgress)}%`}
            </span>
          )}

          <button
            onClick={onToggleTracker}
            style={{
              background: isTrackingActive ? 'rgba(220, 38, 38, 0.3)' : 'rgba(168, 85, 247, 0.3)',
              color: isTrackingActive ? '#fca5a5' : '#d8b4fe',
              border: isTrackingActive ? '1px solid #ef4444' : '1px solid #a855f7',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '10.5px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {isTrackingActive ? 'Stop Tracker' : 'Start Tracker'}
          </button>
        </>
      )}

      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expand Status Pill' : 'Minimize Status Pill'}
        style={{
          background: 'none',
          border: 'none',
          color: '#94a3b8',
          fontSize: '10px',
          cursor: 'pointer',
          padding: '2px 4px'
        }}
      >
        {isCollapsed ? '▶' : '◀'}
      </button>
    </div>
  );
}
