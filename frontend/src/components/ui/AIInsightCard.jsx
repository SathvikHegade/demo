import React from 'react';

export const AIInsightCard = ({ text, title = 'AI Executive Summary', status = 'complete' }) => (
  <div style={{
    background: 'linear-gradient(135deg, rgba(155,89,245,0.06) 0%, rgba(255,107,43,0.04) 100%)',
    border: '1px solid rgba(155,89,245,0.2)',
    borderRadius: 12, padding: 20, position: 'relative', overflow: 'hidden',
  }}>
    {/* Glow top-left */}
    <div style={{ position: 'absolute', top: -20, left: -20, width: 100, height: 100, borderRadius: '50%', background: 'radial-gradient(circle, rgba(155,89,245,0.15), transparent)', pointerEvents: 'none' }} />

    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{ width: 20, height: 20, borderRadius: 5, background: 'linear-gradient(135deg, #9b59f5, #ff6b2b)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      </div>
      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#9b59f5', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {title}
      </span>
      <span style={{ marginLeft: 'auto', fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#5a5a7a', background: 'rgba(155,89,245,0.1)', border: '1px solid rgba(155,89,245,0.15)', borderRadius: 4, padding: '2px 6px' }}>
        GEMINI 2.5
      </span>
    </div>

    <p style={{ fontFamily: 'Inter, Cascadia Code', fontSize: 13.5, color: '#c4c4e0', lineHeight: 1.75, position: 'relative' }}>
      {text}
    </p>
  </div>
);
