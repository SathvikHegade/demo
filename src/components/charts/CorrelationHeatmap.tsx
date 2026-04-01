import React from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';

export const CorrelationHeatmap = () => {
  const data = [
    { name: 'Income x Age', size: 0.85, fill: '#f97316' },
    { name: 'Credit x Loan', size: 0.92, fill: '#ef4444' },
    { name: 'Zip x Region', size: 0.99, fill: '#a855f7' },
    { name: 'Score x Default', size: 0.75, fill: '#eab308' },
    { name: 'Tenure x Activity', size: 0.65, fill: '#22c55e' }
  ];

  return (
    <div className="w-full h-64 bg-[#111118] border border-[#1e1e2e] rounded-lg overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            stroke="#1e1e2e"
            fill="#a855f7"
          >
            <Tooltip contentStyle={{ backgroundColor: '#0a0a0f', borderColor: '#1e1e2e' }} itemStyle={{ color: '#f1f5f9' }} />
          </Treemap>
        </ResponsiveContainer>
    </div>
  );
};
