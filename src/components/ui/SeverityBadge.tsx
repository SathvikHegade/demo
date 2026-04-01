import React from 'react';

export const SeverityBadge = ({ level }: { level: 'CRITICAL' | 'WARNING' | 'INFO' | 'BALANCED' | 'MILD' | 'MODERATE' | 'SEVERE' | 'EXTREME' }) => {
  let color = 'bg-forge-secondary text-white';
  
  if (['CRITICAL', 'SEVERE', 'EXTREME'].includes(level)) color = 'bg-forge-critical text-white';
  if (['WARNING', 'MODERATE'].includes(level)) color = 'bg-forge-warning text-black';
  if (['INFO', 'MILD'].includes(level)) color = 'bg-forge-secondary text-white';
  if (['BALANCED'].includes(level)) color = 'bg-forge-success text-white';

  return (
    <span className={`px-3 py-1 rounded-full font-mono text-xs font-bold tracking-wider shadow-lg ${color}`}>
      {level}
    </span>
  );
};
