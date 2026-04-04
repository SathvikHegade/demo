import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const data = [
  { pair: 'Zip × Region',       corr: 0.99 },
  { pair: 'Credit × Loan',      corr: 0.92 },
  { pair: 'Income × Age',       corr: 0.85 },
  { pair: 'Score × Default',    corr: 0.75 },
  { pair: 'Tenure × Activity',  corr: 0.65 },
];
const col = (v) => v > 0.9 ? '#ef4444' : v > 0.8 ? '#ff6b2b' : v > 0.7 ? '#f59e0b' : '#10b981';

export const CorrelationHeatmap = () => (
  <ResponsiveContainer width="100%" height={220}>
    <BarChart layout="vertical" data={data} margin={{ top: 0, right: 52, left: 8, bottom: 0 }}>
      <XAxis type="number" domain={[0, 1]} hide />
      <YAxis dataKey="pair" type="category" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontFamily: 'Space Mono', fontSize: 10 }} width={112} />
      <Tooltip contentStyle={{ background: '#0c0c14', border: '1px solid #1a1a2e', borderRadius: 10, fontFamily: 'Space Mono', fontSize: 11 }} itemStyle={{ color: '#eef0f8' }} formatter={(v) => v.toFixed(2)} />
      <Bar dataKey="corr" radius={[0, 4, 4, 0]} maxBarSize={18}>
        {data.map((d, i) => <Cell key={i} fill={col(d.corr)} style={{ filter: `drop-shadow(0 0 4px ${col(d.corr)}66)` }} />)}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);
