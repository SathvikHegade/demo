import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export const ScoreRing = ({ value, label, size = 120, stroke = 8 }: { value: number, label: string, size?: number, stroke?: number }) => {
  const [animatedValue, setAnimatedValue] = useState(0);
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (animatedValue / 100) * circumference;

  useEffect(() => {
    let start = 0;
    const increment = value / 50;
    const interval = setInterval(() => {
      start += increment;
      if (start >= value) {
        clearInterval(interval);
        setAnimatedValue(value);
      } else {
        setAnimatedValue(Math.floor(start));
      }
    }, 15);
    return () => clearInterval(interval);
  }, [value]);

  const getColor = (v: number) => v > 80 ? 'text-forge-success' : v > 60 ? 'text-forge-warning' : 'text-forge-critical';

  return (
    <div className="flex flex-col items-center justify-center font-display relative">
      <svg width={size} height={size} className="transform -rotate-90 drop-shadow-md">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke}
          className="stroke-forge-border fill-transparent" />
        <motion.circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke}
          className={`fill-transparent stroke-current transition-all duration-300 ${getColor(value)}`}
          strokeDasharray={circumference}
          strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-2xl font-bold font-mono ${getColor(value)}`}>{animatedValue}</span>
      </div>
      <span className="mt-2 text-sm text-forge-muted tracking-wide">{label}</span>
    </div>
  );
};