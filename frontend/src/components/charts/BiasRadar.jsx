import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';

const data = [
  { subject: 'Dem. Parity',     A: 68 },
  { subject: 'Eq. Opportunity', A: 82 },
  { subject: 'Disp. Impact',    A: 54 },
  { subject: 'Stat. Parity',    A: 73 },
  { subject: 'Calibration',     A: 89 },
  { subject: 'Treat. Equality', A: 61 },
];

export const BiasRadar = () => (
  <ResponsiveContainer width="100%" height={260}>
    <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
      <PolarGrid stroke="rgba(255,255,255,0.05)" />
      <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 10, fontFamily: 'Space Mono' }} />
      <Radar dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.18} dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }} />
      <Tooltip contentStyle={{ background: '#0c0c14', border: '1px solid #1a1a2e', borderRadius: 10, fontFamily: 'Space Mono', fontSize: 11 }} itemStyle={{ color: '#c4b5fd' }} />
    </RadarChart>
  </ResponsiveContainer>
);
