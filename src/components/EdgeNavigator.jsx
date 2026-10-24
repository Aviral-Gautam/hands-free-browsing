// src/components/EdgeNavigator.jsx
// Visual feedback for the screen-edge back / forward navigation zones.
// The cursor must be held in the outer edge band before the action fires.

export default function EdgeNavigator({ side, progress = 0, fired = false }) {
  if (!side) return null;

  const isLeft = side === 'left';
  const accent = fired ? '#22c55e' : '#a855f7';
  const fill = fired ? 100 : Math.max(0, Math.min(100, progress));

  return (
    <>
      {/* Soft gradient band covering the active edge zone */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          [isLeft ? 'left' : 'right']: 0,
          width: '32px',
          background: isLeft
            ? 'linear-gradient(to right, rgba(168, 85, 247, 0.35), rgba(168, 85, 247, 0))'
            : 'linear-gradient(to left, rgba(168, 85, 247, 0.35), rgba(168, 85, 247, 0))',
          pointerEvents: 'none',
          zIndex: 2147483644,
          opacity: fired ? 0.9 : 0.7,
          transition: 'opacity 0.12s ease'
        }}
      />

      {/* Compact hold indicator with progress bar */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          [isLeft ? 'left' : 'right']: '12px',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '7px',
          padding: '9px 7px',
          borderRadius: '12px',
          background: 'rgba(15, 15, 22, 0.88)',
          border: `1.5px solid ${accent}`,
          boxShadow: `0 0 18px ${accent}66, 0 6px 18px rgba(0,0,0,0.5)`,
          color: '#f8fafc',
          pointerEvents: 'none',
          zIndex: 2147483646,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          transition: 'border-color 0.12s ease, box-shadow 0.12s ease'
        }}
      >
        <span style={{ fontSize: '17px', lineHeight: 1 }}>{isLeft ? '◀' : '▶'}</span>

        <div
          style={{
            width: '5px',
            height: '52px',
            borderRadius: '3px',
            background: 'rgba(255, 255, 255, 0.16)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'flex-end'
          }}
        >
          <div
            style={{
              width: '100%',
              height: `${fill}%`,
              background: accent,
              borderRadius: '3px',
              transition: 'height 0.08s linear'
            }}
          />
        </div>

        <span
          style={{
            fontSize: '8.5px',
            fontWeight: 800,
            letterSpacing: '0.4px',
            color: fired ? '#86efac' : '#c4b5fd'
          }}
        >
          {fired ? (isLeft ? 'BACK' : 'FWD') : `${Math.round(fill)}%`}
        </span>
      </div>
    </>
  );
}
