// src/components/ElementHighlighter.jsx

export default function ElementHighlighter({ rect, info, isSnapping }) {
  if (!rect || rect.width === 0 || rect.height === 0) return null;

  // Don't outline if the element covers almost the entire screen
  if (rect.width > window.innerWidth * 0.96 && rect.height > window.innerHeight * 0.96) {
    return null;
  }

  // Padding around highlighted target
  const pad = 4;
  const top = rect.top - pad;
  const left = rect.left - pad;
  const width = rect.width + pad * 2;
  const height = rect.height + pad * 2;

  // Determine pill position (above or below)
  const showAbove = top > 34;
  const pillTop = showAbove ? -28 : height + 5;

  return (
    <div
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: '7px',
        border: isSnapping ? '2.5px solid #38bdf8' : '2px solid #a855f7',
        boxShadow: isSnapping
          ? '0 0 18px rgba(56, 189, 248, 0.7), inset 0 0 10px rgba(56, 189, 248, 0.3)'
          : '0 0 14px rgba(168, 85, 247, 0.5), inset 0 0 6px rgba(168, 85, 247, 0.2)',
        backgroundColor: isSnapping ? 'rgba(56, 189, 248, 0.08)' : 'rgba(168, 85, 247, 0.05)',
        pointerEvents: 'none',
        zIndex: 2147483640,
        transition: 'all 0.12s cubic-bezier(0.2, 0.8, 0.2, 1)'
      }}
    >
      {/* Corner Brackets */}
      <span
        style={{
          position: 'absolute',
          top: '-3px',
          left: '-3px',
          width: '10px',
          height: '10px',
          borderTop: '3px solid #ffffff',
          borderLeft: '3px solid #ffffff',
          borderTopLeftRadius: '5px',
          filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.8))'
        }}
      />
      <span
        style={{
          position: 'absolute',
          bottom: '-3px',
          right: '-3px',
          width: '10px',
          height: '10px',
          borderBottom: '3px solid #ffffff',
          borderRight: '3px solid #ffffff',
          borderBottomRightRadius: '5px',
          filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.8))'
        }}
      />

      {/* Target Description Pill */}
      {info && (info.text || info.type) && (
        <div
          style={{
            position: 'absolute',
            top: `${pillTop}px`,
            left: '0',
            maxWidth: '300px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            backgroundColor: isSnapping ? '#0284c7' : '#7e22ce',
            color: '#ffffff',
            padding: '3px 9px',
            borderRadius: '5px',
            fontSize: '11px',
            fontWeight: '600',
            letterSpacing: '0.3px',
            boxShadow: '0 3px 8px rgba(0, 0, 0, 0.5), 0 0 6px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            pointerEvents: 'none',
            zIndex: 2147483641
          }}
        >
          <span
            style={{
              opacity: 0.9,
              fontSize: '10px',
              textTransform: 'uppercase',
              backgroundColor: 'rgba(255,255,255,0.2)',
              padding: '1px 4px',
              borderRadius: '3px'
            }}
          >
            {info.type}
          </span>
          {info.text && <span>{info.text}</span>}
        </div>
      )}
    </div>
  );
}
