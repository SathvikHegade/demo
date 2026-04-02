import React, { useState } from 'react';

const SEV = {
  CRITICAL: { dot: '#ff3b5c', chip: 'chip chip-critical', label: 'CRITICAL' },
  WARNING: { dot: '#f5a623', chip: 'chip chip-warning', label: 'WARNING' },
  INFO: { dot: '#9b59f5', chip: 'chip chip-info', label: 'INFO' },
  Critical: { dot: '#ff3b5c', chip: 'chip chip-critical', label: 'CRITICAL' },
  Warning: { dot: '#f5a623', chip: 'chip chip-warning', label: 'WARNING' },
};

export const IssueCard = ({ title, severity, description, recommendation }) => {
  const [open, setOpen] = useState(false);
  const s = SEV[severity] ?? SEV['INFO'];

  return (
    <div
      onClick={() => setOpen(v => !v)}
      style={{
        background: '#080810', borderRadius: 10, cursor: 'pointer',
        border: `1px solid ${open ? `${s.dot}33` : 'rgba(255,255,255,0.06)'}`,
        borderLeft: `2px solid ${s.dot}`,
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: open ? `0 0 20px ${s.dot}11` : 'none',
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0, boxShadow: `0 0 6px ${s.dot}` }} />
          <span style={{ fontFamily: 'Inter, Cascadia Code', fontSize: 13, color: '#d0d0e8', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
          <span className={s.chip}>{s.label}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5a5a7a" strokeWidth="2"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {open && (
        <div style={{ padding: '4px 16px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontFamily: 'Inter, Cascadia Code', fontSize: 13, color: '#7a7a9a', lineHeight: 1.7, marginBottom: 12, marginTop: 10 }}>
            {description}
          </p>
          <div style={{ background: 'rgba(155,89,245,0.05)', border: '1px solid rgba(155,89,245,0.15)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#9b59f5', letterSpacing: '0.12em', marginBottom: 6 }}>GEMINI RECOMMENDATION</div>
            <p style={{ fontFamily: 'Inter, Cascadia Code', fontSize: 13, color: '#c4c4e0', lineHeight: 1.65 }}>{recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
};
