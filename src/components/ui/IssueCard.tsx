import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const IssueCard = ({ title, severity, description, recommendation }: { key?: string | number, title: string, severity: 'Critical' | 'Warning' | 'Info', description: string, recommendation: string }) => {
  const [expanded, setExpanded] = useState<boolean>(false);

  const colors = {
    Critical: 'border-forge-critical text-forge-critical',
    Warning: 'border-forge-warning text-forge-warning',
    Info: 'border-forge-secondary text-forge-secondary'
  };

  return (
    <div className={`forge-card p-4 border-l-4 ${colors[severity]} mb-4 cursor-pointer`} onClick={() => setExpanded(!expanded)}>
      <div className="flex justify-between items-center">
        <h4 className="font-display font-semibold text-forge-text">{title}</h4>
        <span className={`text-xs font-mono px-2 py-1 rounded bg-opacity-10 bg-current ${colors[severity]}`}>
          {severity}
        </span>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-4 pt-4 border-t border-forge-border text-sm font-body text-forge-muted"
          >
            <p className="mb-3">{description}</p>
            <div className="bg-[#1a1a2e] p-3 rounded border border-[#a855f7]/30">
              <span className="font-mono text-xs text-[#a855f7] uppercase tracking-widest block mb-1">Claude's Recommendation</span>
              <p className="italic text-[#d8b4fe]">{recommendation}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
