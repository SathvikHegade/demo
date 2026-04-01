import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export const NoiseDonut = ({ data }: { data: any }) => {
  const chartData = [
    { name: 'Outliers', value: data.outliers },
    { name: 'Type Mismatch', value: data.typeMismatch },
    { name: 'Value Noise', value: data.valueNoise },
    { name: 'Structural', value: data.structural },
  ];
  
  const COLORS = ['#f97316', '#eab308', '#a855f7', '#ef4444'];

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
          stroke="none"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ backgroundColor: '#111118', borderColor: '#1e1e2e', borderRadius: '8px' }}
          itemStyle={{ color: '#f1f5f9', fontFamily: 'JetBrains Mono' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};
