// src/components/DisengageBanner.jsx
// Persistent hint shown while tracking is paused. The same action that enters
// disengage (holding both eyes closed for 1.5s) exits it again.

export default function DisengageBanner({ isDisengaged, progress = 0 }) {
  if (!isDisengaged) return null;

  const resuming = progress > 0;
  const accent = resuming ? '#22c55e' : '#94a3b8';

  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        maxWidth: 'calc(100vw - 40px)',
        padding: '7px 13px',
        borderRadius: '14px',
        background: 'rgba(15, 15, 22, 0.94)',
        backdropFilter: 'blur(10px)',
        border: `1.5px solid ${accent}`,
        boxShadow: resuming
          ? '0 0 18px rgba(34, 197, 94, 0.4), 0 4px 16px rgba(0,0,0,0.5)'
          : '0 4px 16px rgba(0,0,0,0.45)',
        pointerEvents: 'none',
        zIndex: 2147483646,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#f8fafc',
        userSelect: 'none',
        transition: 'border-color 0.12s ease, box-shadow 0.12s ease'
      }}
    >
      <span style={{ fontSize: '16px', lineHeight: 1 }}>😴</span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{ fontSize: '11.5px', fontWeight: 800, letterSpacing: '0.3px' }}>
          Tracking paused
        </span>
        <span style={{ fontSize: '10.5px', fontWeight: 600, color: accent }}>
          {resuming
            ? `Keep eyes closed to resume — ${Math.round(progress)}%`
            : 'Hold eyes closed 1.5s to resume'}
        </span>
      </div>

      {resuming && (
        <div
          style={{
            width: '64px',
            height: '5px',
            borderRadius: '3px',
            background: 'rgba(255, 255, 255, 0.16)',
            overflow: 'hidden',
            flexShrink: 0
          }}
        >
          <div
            style={{
              width: `${Math.max(0, Math.min(100, progress))}%`,
              height: '100%',
              background: accent,
              borderRadius: '3px',
              transition: 'width 0.08s linear'
            }}
          />
        </div>
      )}
    </div>
  );
}
