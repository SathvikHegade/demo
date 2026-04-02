import React from 'react';

export const ForgeLoader = ({ size = 72 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
    {/* Animated forge icon */}
    <div style={{ position: 'relative', width: size, height: size }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        border: '1px solid rgba(255,107,43,0.2)',
        animation: 'spin 3s linear infinite',
      }} />
      <div style={{
        position: 'absolute', inset: 6, borderRadius: '50%',
        border: '1px solid rgba(155,89,245,0.2)',
        animation: 'spin 2s linear infinite reverse',
      }} />
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff6b2b" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      </div>
      {/* Orbit dot */}
      <div style={{
        position: 'absolute', top: -3, left: '50%', marginLeft: -3,
        width: 6, height: 6, borderRadius: '50%',
        background: 'linear-gradient(135deg, #ff6b2b, #9b59f5)',
        transformOrigin: '3px 39px',
        animation: 'spin 2s linear infinite',
      }} />
    </div>
    <div>
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#ff6b2b', letterSpacing: '0.15em', textTransform: 'uppercase', textAlign: 'center' }}>
        Forging Analysis<span style={{ animation: 'blink 1s step-end infinite' }}>_</span>
      </div>
    </div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes blink { 0%,100%{opacity:1}50%{opacity:0} }`}</style>
  </div>
);
