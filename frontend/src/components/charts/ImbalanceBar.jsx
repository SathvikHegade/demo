import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

export const ImbalanceBar = () => {
  const [ratio, setRatio] = useState(9);
  const majority = 4500;
  const minority = Math.max(1, Math.round(majority / ratio));
  const data = [{ name: 'Majority', value: majority }, { name: 'Minority', value: minority }];

  return (
    <div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart layout="vertical" data={data} margin={{ top: 0, right: 52, left: 8, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontFamily: 'Space Mono', fontSize: 10 }} width={58} />
          <Tooltip contentStyle={{ background: '#0c0c14', border: '1px solid #1a1a2e', borderRadius: 10, fontFamily: 'Space Mono', fontSize: 11 }} itemStyle={{ color: '#eef0f8' }} formatter={(v) => v.toLocaleString()} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={26}>
            <Cell fill="#8b5cf6" />
            <Cell fill="#ff6b2b" />
            <LabelList dataKey="value" position="right" style={{ fill: '#4b5563', fontFamily: 'Space Mono', fontSize: 10 }} formatter={(v) => v.toLocaleString()} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #1a1a2e' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Space Mono', fontSize: 10, color: '#4b5563', marginBottom: 6 }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Simulate rebalancing</span>
          <span>Ratio: <span style={{ color: '#ff6b2b' }}>{ratio}:1</span></span>
        </div>
        <input type="range" min={1} max={20} value={ratio} onChange={e => setRatio(+e.target.value)} style={{ width: '100%', accentColor: '#ff6b2b' }} />
      </div>
    </div>
  );
};
