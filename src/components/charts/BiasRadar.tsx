import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

export const BiasRadar = () => {
  const data = [
    { subject: 'Demographic Parity', A: 120, fullMark: 150 },
    { subject: 'Equal Opportunity', A: 98, fullMark: 150 },
    { subject: 'Disparate Impact', A: 86, fullMark: 150 },
    { subject: 'Statistical Parity', A: 99, fullMark: 150 },
    { subject: 'Calibration', A: 85, fullMark: 150 },
    { subject: 'Treatment Equality', A: 65, fullMark: 150 },
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
        <PolarGrid stroke="#1e1e2e" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
        <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
        <Radar name="Bias Analysis" dataKey="A" stroke="#a855f7" fill="#a855f7" fillOpacity={0.4} />
        <Tooltip contentStyle={{ backgroundColor: '#111118', borderColor: '#1e1e2e' }} />
      </RadarChart>
    </ResponsiveContainer>
  );
};
