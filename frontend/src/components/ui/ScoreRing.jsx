import React, { useEffect, useState } from 'react';

export const ScoreRing = ({ value, label, size = 120, stroke = 8 }) => {
  const [animated, setAnimated] = useState(0);
  const radius = (size - stroke * 2) / 2;
  const circ = radius * 2 * Math.PI;
  const offset = circ - (animated / 100) * circ;

  useEffect(() => {
    let raf;
    const start = performance.now();
    const dur = 900;
    const tick = (now) => {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setAnimated(value * ease);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const color = value >= 80 ? '#00d97e' : value >= 60 ? '#f5a623' : '#ff3b5c';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={radius} fill="none"
            stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={radius} fill="none"
            stroke={color} strokeWidth={stroke}
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke 0.3s', filter: `drop-shadow(0 0 6px ${color}66)` }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: size * 0.2, color, lineHeight: 1 }}>
            {Math.round(animated)}
          </span>
        </div>
      </div>
      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#5a5a7a', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
};
