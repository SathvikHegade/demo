import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAnalysisStore } from '../store/analysisStore';

export const Report = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { results, datasetName } = useAnalysisStore();
  if (!results) { navigate('/'); return null; }
  const r = results;
  const gradeCol = r.grade === 'A' ? '#10b981' : r.grade === 'B' ? '#22d3ee' : r.grade === 'C' ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: 'DM Sans, Cascadia Code', color: '#111', padding: '48px' }} id="report-content">
      {/* Print buttons */}
      <div style={{ position: 'fixed', top: 24, right: 24, display: 'flex', gap: 10, zIndex: 100 }} className="print:hidden">
        <button onClick={() => navigate(-1)} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 11 }}>← Back</button>
        <button onClick={() => window.print()} style={{ background: 'linear-gradient(135deg,#ff6b2b,#8b5cf6)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 11, fontWeight: 700 }}>Export PDF</button>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '3px solid #111', paddingBottom: 24, marginBottom: 36 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 20, fontWeight: 700 }}>⬡</span>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em' }}>DataForge Quality Report</span>
            </div>
            <h1 style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 800, fontSize: '2rem', margin: '0 0 6px', letterSpacing: '-0.02em' }}>{datasetName || 'Dataset Analysis'}</h1>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#888', margin: 0 }}>Job ref: {r.job_id}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 800, fontSize: '4rem', color: gradeCol, lineHeight: 1 }}>{r.grade}</div>
            <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#888', marginTop: 4 }}>{new Date(r.generated_at).toLocaleDateString()}</div>
          </div>
        </div>

        {/* Executive Summary */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 700, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ff6b2b', borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 14 }}>1 · Executive Summary</h2>
          <blockquote style={{ margin: 0, padding: '14px 20px', background: '#fafafa', borderLeft: '3px solid #ff6b2b', fontStyle: 'italic', color: '#444', lineHeight: 1.75, fontSize: '0.95rem' }}>"{r.executive_summary}"</blockquote>
        </section>

        {/* Core Metrics */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 700, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8b5cf6', borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 14 }}>2 · Core Metrics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[['Rows', r.dataset_info.rows.toLocaleString()], ['Columns', r.dataset_info.columns], ['Size', `${r.dataset_info.size_mb.toFixed(1)} MB`], ['Score', `${r.overall_quality_score.toFixed(1)}/100`]].map(([k, v]) => (
              <div key={k} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6 }}>{k}</div>
                <div style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 800, fontSize: '1.4rem', color: '#111' }}>{v}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Dimensions */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 700, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ff6b2b', borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 14 }}>3 · Quality Dimensions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {Object.entries(r.dimension_scores).map(([k, v]) => (
              <div key={k} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 800, fontSize: '1.5rem', color: v >= 80 ? '#10b981' : v >= 60 ? '#f59e0b' : '#ef4444' }}>{v.toFixed(0)}</div>
                <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', marginTop: 4 }}>{k}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Issues */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 700, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ef4444', borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 14 }}>4 · Issues ({r.issues.length})</h2>
          {r.issues.map(issue => (
            <div key={issue.id} style={{ border: '1px solid #e5e7eb', borderLeft: `3px solid ${issue.severity === 'CRITICAL' ? '#ef4444' : issue.severity === 'WARNING' ? '#f59e0b' : '#8b5cf6'}`, borderRadius: 8, padding: '14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, fontWeight: 700 }}>{issue.id}</span>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, background: issue.severity === 'CRITICAL' ? '#fee2e2' : issue.severity === 'WARNING' ? '#fef3c7' : '#ede9fe', color: issue.severity === 'CRITICAL' ? '#dc2626' : issue.severity === 'WARNING' ? '#d97706' : '#7c3aed', padding: '2px 8px', borderRadius: 4 }}>{issue.severity}</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#555', lineHeight: 1.65, margin: '0 0 8px' }}>{issue.description}</p>
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#7c3aed', margin: 0 }}>→ {issue.recommendation}</p>
            </div>
          ))}
        </section>

        <footer style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, textAlign: 'center', fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#9ca3af' }}>
          Generated by DataForge · Powered by Gemini 2.5 Flash · {new Date(r.generated_at).toISOString()}
        </footer>
      </div>
    </div>
  );
};
