import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export const OutlierBoxPlot = ({ outlierDetails = [] }) => {
  const ref = useRef(null);

  const cols = outlierDetails.length > 0
    ? outlierDetails.map(o => ({
        label: o.column,
        method: o.method || 'IQR',
        q1: o.lower_bound ?? 0,
        med: ((o.lower_bound ?? 0) + (o.upper_bound ?? 100)) / 2,
        q3: o.upper_bound ?? 100,
        low: (o.lower_bound ?? 0) * 0.7,
        high: (o.upper_bound ?? 100) * 1.1,
        outlierCount: o.outlier_count,
        outlierFraction: o.outlier_fraction,
        suggestedCap: o.suggested_cap_value,
        out: o.outlier_count > 0
          ? [o.upper_bound * 1.2, o.upper_bound * 1.5].slice(0, Math.min(o.outlier_count, 2))
          : [],
      }))
    : [
        { label: 'age',    method: 'IQR', q1: 25, med: 36, q3: 50, low: 18,  high: 72,  outlierCount: 3, outlierFraction: 0.03, suggestedCap: 72,  out: [215, 287] },
        { label: 'income', method: 'IQR', q1: 38, med: 62, q3: 95, low: 12,  high: 180, outlierCount: 2, outlierFraction: 0.02, suggestedCap: 180, out: [430, 610] },
      ];

  useEffect(() => {
    if (!ref.current) return;
    const W = ref.current.clientWidth || 480;
    const H = 150;
    const m = { top: 20, right: 20, bottom: 30, left: 36 };
    const svg = d3.select(ref.current).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();

    const bw = (W - m.left - m.right) / cols.length;
    const bh = 28;

    cols.forEach((c, ci) => {
      const allVals = [c.low, c.q1, c.med, c.q3, c.high, ...c.out].filter(v => v != null && isFinite(v));
      if (allVals.length === 0) return;
      const xScale = d3.scaleLinear()
        .domain([d3.min(allVals) * 0.85, d3.max(allVals) * 1.15])
        .range([m.left + ci * bw + 10, m.left + (ci + 1) * bw - 10]);
      const cy2 = m.top + (H - m.top - m.bottom) / 2;

      // whisker line
      svg.append('line')
        .attr('x1', xScale(c.low)).attr('x2', xScale(c.high))
        .attr('y1', cy2).attr('y2', cy2)
        .attr('stroke', '#252540').attr('stroke-width', 1.5);
      [c.low, c.high].forEach(v => {
        svg.append('line')
          .attr('x1', xScale(v)).attr('x2', xScale(v))
          .attr('y1', cy2 - 8).attr('y2', cy2 + 8)
          .attr('stroke', '#252540').attr('stroke-width', 1.5);
      });

      // IQR box
      svg.append('rect')
        .attr('x', xScale(c.q1)).attr('y', cy2 - bh / 2)
        .attr('width', Math.max(1, xScale(c.q3) - xScale(c.q1))).attr('height', bh)
        .attr('fill', 'rgba(255,107,43,0.12)').attr('stroke', '#ff6b2b')
        .attr('stroke-width', 1.5).attr('rx', 4);

      // median
      svg.append('line')
        .attr('x1', xScale(c.med)).attr('x2', xScale(c.med))
        .attr('y1', cy2 - bh / 2).attr('y2', cy2 + bh / 2)
        .attr('stroke', '#ff6b2b').attr('stroke-width', 2.5);

      // outlier dots
      c.out.forEach(o => {
        svg.append('circle').attr('cx', xScale(o)).attr('cy', cy2).attr('r', 5.5)
          .attr('fill', '#ef444420').attr('stroke', '#ef4444').attr('stroke-width', 1.5);
      });

      // label
      svg.append('text')
        .attr('x', xScale((c.q1 + c.q3) / 2)).attr('y', m.top + (H - m.top - m.bottom) + 16)
        .attr('text-anchor', 'middle').attr('fill', '#4b5563')
        .attr('font-size', 10).attr('font-family', 'Space Mono').text(c.label);
    });

    // Legend
    [['#ff6b2b', 'IQR'], ['#ef4444', 'Outlier']].forEach(([c, l], i) => {
      svg.append('circle').attr('cx', m.left + i * 72 + 4).attr('cy', 10).attr('r', 4).attr('fill', c);
      svg.append('text').attr('x', m.left + i * 72 + 12).attr('y', 14)
        .attr('fill', '#4b5563').attr('font-size', 9).attr('font-family', 'Space Mono').text(l);
    });
  }, [cols]);

  if (!outlierDetails || outlierDetails.length === 0) {
    return (
      <div>
        <div style={{
          marginBottom: 14, padding: '12px 16px',
          background: 'rgba(255,107,43,0.05)',
          border: '1px solid rgba(255,107,43,0.15)', borderRadius: 8,
        }}>
          <div style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 700, fontSize: 12, color: '#f0f0f8', marginBottom: 6 }}>
            How to read this chart
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[
              { color: '#ff6b2b', label: 'Orange box', desc: 'Middle 50% of your data (IQR — Interquartile Range). Normal, expected values.' },
              { color: '#ff6b2b', label: 'Orange line', desc: 'Median value. Half the data falls above, half below.' },
              { color: '#252540', label: 'Whisker lines', desc: 'Furthest "normal" values — data still within acceptable range.' },
              { color: '#ef4444', label: 'Red circles', desc: 'Outliers — values so extreme they lie outside 1.5× the IQR. These need your attention.' },
            ].map(({ color, label, desc }) => (
              <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginTop: 3, flexShrink: 0 }} />
                <span style={{ fontFamily: 'Inter, Cascadia Code', fontSize: 11, color: '#7a7a9a', lineHeight: 1.5 }}>
                  <strong style={{ color: '#f0f0f8', fontWeight: 500 }}>{label}:</strong> {desc}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '32px 0', textAlign: 'center', fontFamily: 'Space Mono, monospace', fontSize: 11, color: '#5a5a7a', letterSpacing: '0.08em' }}>
          ✓ NO OUTLIERS DETECTED
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Explainer box */}
      <div style={{
        marginBottom: 14, padding: '12px 16px',
        background: 'rgba(255,107,43,0.05)',
        border: '1px solid rgba(255,107,43,0.15)', borderRadius: 8,
      }}>
        <div style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 700, fontSize: 12, color: '#f0f0f8', marginBottom: 6 }}>
          How to read this chart
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[
            { color: '#ff6b2b', label: 'Orange box', desc: 'Middle 50% of your data (IQR — Interquartile Range). Normal, expected values.' },
            { color: '#ff6b2b', label: 'Orange line', desc: 'Median value. Half the data falls above, half below.' },
            { color: '#252540', label: 'Whisker lines', desc: 'Furthest "normal" values — data still within acceptable range.' },
            { color: '#ef4444', label: 'Red circles', desc: 'Outliers — values so extreme they lie outside 1.5× the IQR. These need your attention.' },
          ].map(({ color, label, desc }) => (
            <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginTop: 3, flexShrink: 0 }} />
              <span style={{ fontFamily: 'Inter, Cascadia Code', fontSize: 11, color: '#7a7a9a', lineHeight: 1.5 }}>
                <strong style={{ color: '#f0f0f8', fontWeight: 500 }}>{label}:</strong> {desc}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* D3 chart */}
      <svg ref={ref} style={{ width: '100%' }} />

      {/* Per-column summary pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        {cols.map(c => (
          <div key={c.label} style={{
            padding: '6px 12px',
            background: c.outlierCount > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(0,217,126,0.08)',
            border: `1px solid ${c.outlierCount > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(0,217,126,0.3)'}`,
            borderRadius: 99,
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.outlierCount > 0 ? '#ef4444' : '#00d97e' }} />
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#f0f0f8', letterSpacing: '0.06em' }}>
              {c.label}
            </span>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: c.outlierCount > 0 ? '#ef4444' : '#00d97e' }}>
              {c.outlierCount > 0 ? `${c.outlierCount} outliers` : 'clean'}
            </span>
            {c.suggestedCap != null && c.outlierCount > 0 && (
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#5a5a7a' }}>
                · cap at {c.suggestedCap.toLocaleString()}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};