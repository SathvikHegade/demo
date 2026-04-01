import React from 'react';

export const AIInsightCard = ({ text, title = "AI Executive Summary" }: { text: string, title?: string }) => {
  return (
    <div className="p-1 rounded-xl bg-gradient-to-r from-forge-secondary to-forge-primary hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all">
      <div className="bg-forge-surface p-5 rounded-lg h-full">
        <h3 className="flex items-center text-forge-secondary font-bold font-display uppercase tracking-wider text-sm mb-3">
          <svg className="w-5 h-5 mr-2 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {title}
        </h3>
        <p className="text-forge-text font-body text-sm leading-relaxed overflow-hidden border-r-2 border-forge-secondary whitespace-normal animate-[typing_2.5s_steps(40,end)_forwards]">
          {text}
        </p>
      </div>
    </div>
  );
};