import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

export const ImbalanceBar = ({ classDistribution = [], imbalanceRatio = 1, targetColumn = 'target' }) => {
  const [simRatio, setSimRatio] = useState(Math.max(1, Math.round(imbalanceRatio)));

  const majorityCount = classDistribution.length > 0
    ? Math.max(...classDistribution.map(c => c.count))
    : 4500;
  const minorityOriginal = classDistribution.length > 0
    ? Math.min(...classDistribution.map(c => c.count))
    : Math.round(majorityCount / Math.max(imbalanceRatio, 1));

  const minoritySim = Math.max(1, Math.round(majorityCount / simRatio));

  const actualData = classDistribution.length > 0
    ? classDistribution.map(c => ({ name: c.label, value: c.count }))
    : [{ name: 'Majority', value: majorityCount }, { name: 'Minority', value: minorityOriginal }];

  const simData = [
    { name: 'Majority (sim)', value: majorityCount },
    { name: 'Minority (sim)', value: minoritySim },
  ];

  // Stats row
  const majorityClass = classDistribution.length > 0
    ? classDistribution.reduce((a, b) => a.count > b.count ? a : b)
    : { label: 'Majority', count: majorityCount, fraction: majorityCount / (majorityCount + minorityOriginal) };
  const minorityClass = classDistribution.length > 0
    ? classDistribution.reduce((a, b) => a.count < b.count ? a : b)
    : { label: 'Minority', count: minorityOriginal, fraction: minorityOriginal / (majorityCount + minorityOriginal) };

  const entropy = classDistribution.length > 0
    ? -classDistribution.reduce((s, c) => {
        const p = c.fraction; return s + (p > 0 ? p * Math.log2(p) : 0);
      }, 0)
    : 0;
  const maxEntropy = Math.log2(Math.max(classDistribution.length, 2));
  const entropyPct = maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 100) : 0;

  // Severity & explainer
  const severity = imbalanceRatio >= 10 ? 'EXTREME'
    : imbalanceRatio >= 3 ? 'MODERATE'
    : imbalanceRatio >= 1.5 ? 'MILD' : 'BALANCED';

  const SEVERITY_EXPLANATIONS = {
    EXTREME: {
      color: '#ff3b5c',
      headline: 'Extreme imbalance — model will predict only majority class',
      body: `A ${imbalanceRatio.toFixed(0)}:1 ratio means your model can achieve ${Math.round((majorityCount / (majorityCount + minorityOriginal)) * 100)}% accuracy simply by predicting the majority class every time. This makes the minority class completely invisible to standard classifiers. Apply SMOTE oversampling or use class_weight="balanced" before any training.`,
    },
    MODERATE: {
      color: '#f5a623',
      headline: 'Moderate imbalance — accuracy metric is misleading',
      body: `With a ${imbalanceRatio.toFixed(1)}:1 ratio, accuracy scores look high but the model will under-serve the minority class. Use F1-score, AUC-ROC, or precision-recall curves instead of raw accuracy. Consider SMOTE or random oversampling.`,
    },
    MILD: {
      color: '#ff6b2b',
      headline: 'Mild imbalance — worth addressing before training',
      body: `A ${imbalanceRatio.toFixed(1)}:1 ratio is manageable but can bias model decisions toward the majority class. Using class_weight="balanced" in sklearn or adjusting decision thresholds is usually sufficient.`,
    },
    BALANCED: {
      color: '#00d97e',
      headline: 'Well balanced — no action needed',
      body: 'Class distribution is healthy. Proceed with standard training without rebalancing.',
    },
  };

  const exp = SEVERITY_EXPLANATIONS[severity];
  const sevBg = severity === 'EXTREME' ? '255,59,92' : severity === 'MODERATE' ? '245,166,35' : severity === 'MILD' ? '255,107,43' : '0,217,126';

  const tooltipStyle = { background: '#0c0c14', border: '1px solid #1a1a2e', borderRadius: 10, fontFamily: 'Space Mono', fontSize: 11 };

  const StatMini = ({ label, value, sub, color = '#f0f0f8' }) => (
    <div style={{ flex: 1, background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 14px', minWidth: 0 }}>
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: '#5a5a7a', letterSpacing: '0.12em', marginBottom: 6, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 16, color, lineHeight: 1, wordBreak: 'break-all' }}>{value}</div>
      {sub && <div style={{ fontFamily: 'Inter, Cascadia Code', fontSize: 10, color: '#5a5a7a', marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <StatMini label="Majority Class" value={majorityClass.label} sub={`${majorityClass.count.toLocaleString()} · ${Math.round((majorityClass.fraction ?? 0) * 100)}%`} color="#8b5cf6" />
        <StatMini label="Minority Class" value={minorityClass.label} sub={`${minorityClass.count.toLocaleString()} · ${Math.round((minorityClass.fraction ?? 0) * 100)}%`} color="#ff6b2b" />
        <StatMini label="Imbalance Ratio" value={`${imbalanceRatio.toFixed(1)}:1`} color="#f5a623" />
        <StatMini label="Distribution Entropy" value={`${entropyPct}%`} sub="100% = perfectly balanced" color={entropyPct > 70 ? '#00d97e' : entropyPct > 40 ? '#f5a623' : '#ff3b5c'} />
      </div>

      {/* Actual distribution */}
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#5a5a7a', letterSpacing: '0.1em', marginBottom: 6 }}>ACTUAL DISTRIBUTION</div>
      <ResponsiveContainer width="100%" height={Math.max(80, actualData.length * 36)}>
        <BarChart layout="vertical" data={actualData} margin={{ top: 0, right: 52, left: 8, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontFamily: 'Space Mono', fontSize: 10 }} width={72} />
          <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#eef0f8' }} formatter={v => v.toLocaleString()} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={26}>
            {actualData.map((_, i) => (
              <Cell key={i} fill={i === 0 ? '#8b5cf6' : '#ff6b2b'} />
            ))}
            <LabelList dataKey="value" position="right" style={{ fill: '#4b5563', fontFamily: 'Space Mono', fontSize: 10 }} formatter={v => v.toLocaleString()} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* After rebalancing simulator */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #1a1a2e' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Space Mono', fontSize: 10, color: '#4b5563', marginBottom: 6 }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rebalancing Simulator — drag to see target minority count</span>
          <span>Target ratio: <span style={{ color: '#ff6b2b' }}>{simRatio}:1</span></span>
        </div>
        <input type="range" min={1} max={Math.max(20, Math.ceil(imbalanceRatio) + 5)} value={simRatio} onChange={e => setSimRatio(+e.target.value)} style={{ width: '100%', accentColor: '#ff6b2b' }} />
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#9b59f5', marginTop: 6, letterSpacing: '0.04em' }}>
          If you apply SMOTE to reach {simRatio}:1 → minority class would have ~{minoritySim.toLocaleString()} samples (was {minorityOriginal.toLocaleString()})
        </div>
      </div>

      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#5a5a7a', letterSpacing: '0.1em', marginTop: 14, marginBottom: 6 }}>AFTER REBALANCING (SIMULATED)</div>
      <ResponsiveContainer width="100%" height={80}>
        <BarChart layout="vertical" data={simData} margin={{ top: 0, right: 52, left: 8, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontFamily: 'Space Mono', fontSize: 10 }} width={88} />
          <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#eef0f8' }} formatter={v => v.toLocaleString()} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22}
            style={{ strokeDasharray: '4 2', stroke: 'rgba(255,255,255,0.2)' }}>
            <Cell fill="rgba(139,92,246,0.5)" />
            <Cell fill="rgba(255,107,43,0.5)" />
            <LabelList dataKey="value" position="right" style={{ fill: '#4b5563', fontFamily: 'Space Mono', fontSize: 10 }} formatter={v => v.toLocaleString()} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* What this means explainer */}
      <div style={{
        marginTop: 16, padding: '14px 16px',
        background: `rgba(${sevBg},0.06)`,
        border: `1px solid ${exp.color}33`,
        borderLeft: `3px solid ${exp.color}`,
        borderRadius: 8,
      }}>
        <div style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 700, fontSize: 12, color: exp.color, marginBottom: 6 }}>
          {exp.headline}
        </div>
        <p style={{ fontFamily: 'Inter, Cascadia Code', fontSize: 12, color: '#7a7a9a', lineHeight: 1.7, margin: 0 }}>
          {exp.body}
        </p>
      </div>
    </div>
  );
};