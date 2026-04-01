import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const ImbalanceBar = () => {
  const [ratio, setRatio] = useState(4.2);
  const baseData = [
    { name: 'Retained', count: 42000 },
    { name: 'Churned', count: Math.floor(42000 / ratio) }
  ];

  return (
    <div>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart layout="vertical" data={baseData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <XAxis type="number" hide />
          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#f1f5f9', fontFamily: 'Inter' }} />
          <Tooltip cursor={{ fill: '#1e1e2e' }} contentStyle={{ backgroundColor: '#111118', borderColor: '#f97316' }} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#64748b', fontFamily: 'JetBrains Mono' }}>
            <Cell fill="#a855f7" />
            <Cell fill="#f97316" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      <div className="mt-6 border-t border-forge-border pt-4">
        <h4 className="font-mono text-xs text-forge-muted mb-2">Simulate Rebalancing</h4>
        <input 
           type="range" 
           min="1" 
           max="10" 
           step="0.1" 
           value={ratio} 
           onChange={(e) => setRatio(Number(e.target.value))}
           className="w-full h-2 bg-forge-bg rounded-lg appearance-none cursor-pointer accent-forge-primary"
        />
        <div className="flex justify-between text-xs font-mono mt-2 text-forge-muted">
           <span>Balanced (1:1)</span>
           <span>Current Ratio (<span className="text-forge-primary">{ratio.toFixed(1)}:1</span>)</span>
           <span>Extreme (10:1)</span>
        </div>
      </div>
    </div>
  );
};
