import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAnalysisStore } from '../store/analysisStore';

export const Navbar = () => {
  const { status, reset } = useAnalysisStore();
  const navigate = useNavigate();

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(20px)',
      background: 'rgba(4,4,10,0.85)',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Logo */}
        <Link to="/" onClick={() => reset()} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'linear-gradient(135deg, #ff6b2b, #9b59f5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <span style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 800, fontSize: 17, color: '#f0f0f8', letterSpacing: '-0.02em' }}>
            Data<span style={{ background: 'linear-gradient(135deg,#ff6b2b,#9b59f5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Forge</span>
          </span>
        </Link>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {status !== 'idle' && (
            <button
              onClick={() => { reset(); navigate('/'); }}
              style={{
                fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'rgba(255,107,43,0.8)',
                background: 'rgba(255,107,43,0.08)', border: '1px solid rgba(255,107,43,0.2)',
                borderRadius: 6, padding: '5px 12px', cursor: 'pointer', letterSpacing: '0.06em',
              }}
            >
              ← NEW ANALYSIS
            </button>
          )}
          <a href="https://github.com" target="_blank" rel="noreferrer"
            style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#5a5a7a', textDecoration: 'none', letterSpacing: '0.06em' }}>
            GITHUB
          </a>
          <a href="/docs" target="_blank" rel="noreferrer"
            style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#5a5a7a', textDecoration: 'none', letterSpacing: '0.06em' }}>
            API DOCS
          </a>
        </div>
      </div>
    </nav>
  );
};
