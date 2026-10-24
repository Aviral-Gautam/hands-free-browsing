// src/components/DwellIndicator.jsx

export default function DwellIndicator({ x, y, progress, isComplete, isSettling = false }) {
  if (progress <= 0 && !isComplete && !isSettling) return null;

  const size = 48;
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = isSettling && progress === 0
    ? circumference * 0.8
    : circumference - (progress / 100) * circumference;

  return (
    <div
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        width: `${size}px`,
        height: `${size}px`,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 2147483646,
        transition: 'transform 0.05s ease-out'
      }}
    >
      <svg
        width={size}
        height={size}
        style={{
          transform: 'rotate(-90deg)',
          display: 'block'
        }}
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth={strokeWidth}
        />
        {/* Animated Progress Ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill={isComplete ? 'rgba(34, 197, 94, 0.25)' : 'none'}
          stroke={isComplete ? '#22c55e' : isSettling && progress === 0 ? 'rgba(255, 255, 255, 0.4)' : '#a855f7'}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transition: progress === 0 ? 'none' : 'stroke-dashoffset 0.05s linear, stroke 0.2s'
          }}
        />
      </svg>
    </div>
  );
}
