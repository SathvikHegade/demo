import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#ff6b2b', '#f59e0b', '#8b5cf6', '#6b7280'];
const LABELS = ['Outliers', 'Format Errors', 'Missing', 'Structural'];

export const NoiseDonut = ({ data }) => {
  const chartData = [
    { name: LABELS[0], value: Math.max(data.outliers, 0) },
    { name: LABELS[1], value: Math.max(data.typeMismatch, 0) },
    { name: LABELS[2], value: Math.max(data.valueNoise, 0) },
    { name: LABELS[3], value: Math.max(data.structural, 0) },
  ].filter(d => d.value > 0);
  if (chartData.length === 0) chartData.push({ name: 'Clean', value: 1 });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} style={{ filter: `drop-shadow(0 0 6px ${COLORS[i % COLORS.length]}88)` }} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ background: '#0c0c14', border: '1px solid #1a1a2e', borderRadius: 10, fontFamily: 'Space Mono', fontSize: 11 }} itemStyle={{ color: '#eef0f8' }} formatter={(v) => v.toLocaleString()} />
      </PieChart>
    </ResponsiveContainer>
  );
};
