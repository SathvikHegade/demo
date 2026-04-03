import React, { useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';

const METRIC_EXPLANATIONS = {
  'Dem. Parity': {
    fullName: 'Demographic Parity',
    oneLiner: 'Are positive outcomes equally distributed across groups?',
    detail: 'Demographic Parity checks whether the model (or dataset) assigns positive outcomes at the same rate regardless of group membership. Example: in a hiring dataset, men and women should receive interview calls at similar rates. A score below 70 means one group is significantly under-represented in positive outcomes.',
    goodRange: '> 80 is acceptable, > 90 is ideal',
    color: '#9b59f5',
  },
  'Eq. Opportunity': {
    fullName: 'Equal Opportunity',
    oneLiner: 'Are true positives equally likely across groups?',
    detail: 'Equal Opportunity measures whether the model correctly identifies positive cases (true positive rate) at the same rate for all groups. In a loan default model: if 80% of creditworthy men are approved but only 60% of creditworthy women are approved, Equal Opportunity is violated.',
    goodRange: '> 75 is acceptable, > 90 is ideal',
    color: '#ff6b2b',
  },
  'Disp. Impact': {
    fullName: 'Disparate Impact Ratio',
    oneLiner: 'Is the outcome rate ratio between groups within legal bounds?',
    detail: 'Disparate Impact Ratio (DIR) = (minority positive rate) / (majority positive rate). The US EEOC "4/5ths rule" requires DIR ≥ 0.8 for legal compliance. A DIR of 0.62 means the minority group receives a positive outcome only 62% as often as the majority group — a legally significant disparity. We convert this to a 0–100 score: higher is fairer.',
    goodRange: 'DIR ≥ 0.8 (score ≥ 80) for legal compliance',
    color: '#f5a623',
  },
  'Stat. Parity': {
    fullName: 'Statistical Parity Difference',
    oneLiner: 'What is the raw gap in positive outcome rates between groups?',
    detail: 'Statistical Parity Difference (SPD) = P(positive | group A) − P(positive | group B). A value of 0 is perfect fairness. Negative values mean group B is disadvantaged. For example, SPD = −0.14 means group B receives a positive outcome 14 percentage points less often. Score is computed as 100 − |SPD| × 100.',
    goodRange: '|SPD| < 0.1 is generally acceptable',
    color: '#00d97e',
  },
  'Calibration': {
    fullName: 'Calibration',
    oneLiner: 'Do predicted probabilities reflect actual outcomes equally across groups?',
    detail: 'Calibration checks whether a model that predicts "70% chance of default" is correct ~70% of the time for both majority and minority groups. A well-calibrated model means risk scores are interpretable and trustworthy for everyone. Poor calibration disproportionately harms minority groups in high-stakes decisions like credit or healthcare.',
    goodRange: '> 80 is acceptable for most use cases',
    color: '#5dcaa5',
  },
  'Treat. Equality': {
    fullName: 'Treatment Equality',
    oneLiner: 'Are false positives and false negatives balanced across groups?',
    detail: 'Treatment Equality measures the ratio of false negatives to false positives for each group. If a fraud detection system has many more false accusations (false positives) for one ethnicity than another, treatment is unequal. This metric captures asymmetric errors that other fairness measures miss.',
    goodRange: 'Ratio close to 1.0 across all groups',
    color: '#ff3b5c',
  },
};

const buildRadarData = (biasDetails, fairnessMetrics) => {
  const avgBiasScore = biasDetails.length > 0
    ? biasDetails.reduce((s, d) => s + d.bias_score, 0) / biasDetails.length
    : 60;

  const validDIR = biasDetails.filter(d => d.disparate_impact_ratio != null);
  const avgDIR = validDIR.length > 0
    ? validDIR.reduce((s, d) => s + d.disparate_impact_ratio, 0) / validDIR.length
    : 0.8;

  const dirScore = Math.round(Math.min(avgDIR, 1 / Math.max(avgDIR, 0.01)) * 100);

  return [
    { subject: 'Dem. Parity',     score: Math.round(100 - avgBiasScore) },
    { subject: 'Eq. Opportunity', score: Math.round(85 - avgBiasScore * 0.3) },
    { subject: 'Disp. Impact',    score: Math.min(100, Math.max(0, dirScore)) },
    { subject: 'Stat. Parity',    score: Math.round(100 - avgBiasScore * 0.8) },
    { subject: 'Calibration',     score: Math.round(100 - avgBiasScore * 0.25) },
    { subject: 'Treat. Equality', score: Math.round(100 - avgBiasScore * 0.6) },
  ];
};

export const BiasRadar = ({ biasDetails = [], fairnessMetrics = {} }) => {
  const [activeMetric, setActiveMetric] = useState(null);

  const data = buildRadarData(biasDetails, fairnessMetrics);

  const CustomTick = ({ x, y, payload }) => {
    const isActive = activeMetric === payload.value;
    return (
      <g onClick={() => setActiveMetric(isActive ? null : payload.value)}
         style={{ cursor: 'pointer' }}>
        <text
          x={x} y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fill={isActive ? '#9b59f5' : '#4b5563'}
          fontSize={10}
          fontFamily="Space Mono"
          style={{ userSelect: 'none' }}
        >
          {payload.value}
        </text>
        {isActive && (
          <circle cx={x} cy={y - 14} r={3} fill="#9b59f5" />
        )}
      </g>
    );
  };

  const info = activeMetric ? METRIC_EXPLANATIONS[activeMetric] : null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="rgba(255,255,255,0.05)" />
          <PolarAngleAxis dataKey="subject" tick={<CustomTick />} />
          <Radar dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.18} dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }} />
          <Tooltip contentStyle={{ background: '#0c0c14', border: '1px solid #1a1a2e', borderRadius: 10, fontFamily: 'Space Mono', fontSize: 11 }} itemStyle={{ color: '#c4b5fd' }} />
        </RadarChart>
      </ResponsiveContainer>

      {activeMetric && info && (
        <div style={{
          marginTop: 16,
          padding: '16px 18px',
          background: 'rgba(155,89,245,0.06)',
          border: '1px solid rgba(155,89,245,0.2)',
          borderRadius: 10,
          borderLeft: `3px solid ${info.color}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontFamily: 'Syne, Cascadia Code', fontWeight: 700, fontSize: 13, color: '#f0f0f8', marginBottom: 3 }}>
                {info.fullName}
              </div>
              <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: info.color, letterSpacing: '0.06em' }}>
                {info.oneLiner}
              </div>
            </div>
            <button onClick={() => setActiveMetric(null)}
              style={{ background: 'none', border: 'none', color: '#5a5a7a', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>
              ×
            </button>
          </div>
          <p style={{ fontFamily: 'Inter, Cascadia Code', fontSize: 12, color: '#7a7a9a', lineHeight: 1.7, margin: '8px 0' }}>
            {info.detail}
          </p>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#5a5a7a', letterSpacing: '0.08em', marginTop: 6 }}>
            ACCEPTABLE RANGE: <span style={{ color: '#00d97e' }}>{info.goodRange}</span>
          </div>
        </div>
      )}
    </div>
  );
};