// src/components/VoiceHUD.jsx

export default function VoiceHUD({
  isListening,
  status,
  transcript,
  lastCommand,
  onToggleMic,
  isSupported
}) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '18px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px',
        zIndex: 9999996,
        pointerEvents: 'auto',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        userSelect: 'none'
      }}
    >
      {/* Main Microphone Button & Status Pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(18, 18, 24, 0.92)',
          backdropFilter: 'blur(10px)',
          padding: '6px 12px',
          borderRadius: '24px',
          border: isListening ? '1.5px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: isListening
            ? '0 0 16px rgba(239, 68, 68, 0.5), 0 4px 16px rgba(0,0,0,0.4)'
            : '0 4px 16px rgba(0,0,0,0.3)',
          transition: 'all 0.2s ease'
        }}
      >
        {/* Animated Sound Wave or Status Dot */}
        {isListening ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '14px' }}>
            <span
              style={{
                width: '3px',
                height: '8px',
                backgroundColor: '#ef4444',
                borderRadius: '2px',
                animation: 'wave 0.8s infinite ease-in-out'
              }}
            />
            <span
              style={{
                width: '3px',
                height: '14px',
                backgroundColor: '#ef4444',
                borderRadius: '2px',
                animation: 'wave 0.8s infinite ease-in-out 0.2s'
              }}
            />
            <span
              style={{
                width: '3px',
                height: '10px',
                backgroundColor: '#ef4444',
                borderRadius: '2px',
                animation: 'wave 0.8s infinite ease-in-out 0.4s'
              }}
            />
          </div>
        ) : (
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isSupported ? '#10b981' : '#64748b'
            }}
          />
        )}

        <button
          onClick={onToggleMic}
          disabled={!isSupported}
          title={
            !isSupported
              ? 'Speech recognition not supported in this browser'
              : isListening
              ? 'Mute Microphone'
              : 'Turn on Voice Search & Dictation'
          }
          style={{
            background: 'none',
            border: 'none',
            color: '#f8fafc',
            fontSize: '12px',
            fontWeight: '600',
            cursor: isSupported ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: 0
          }}
        >
          <span>{isListening ? '🎙️ Listening...' : '🎤 Voice Search'}</span>
        </button>

        {status === 'permission-denied' && (
          <span style={{ fontSize: '10px', color: '#fca5a5' }}>(Mic blocked)</span>
        )}
      </div>

      {/* Live Transcript Banner */}
      {isListening && transcript && (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.95)',
            color: '#38bdf8',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            maxWidth: '300px',
            border: '1px solid #0284c7',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            wordBreak: 'break-word',
            animation: 'fadeIn 0.15s ease'
          }}
        >
          "{transcript}"
        </div>
      )}

      {/* Command Confirmation Toast */}
      {lastCommand && (
        <div
          style={{
            background: '#15803d',
            color: '#ffffff',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '600',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          ✓ {lastCommand}
        </div>
      )}
    </div>
  );
}
