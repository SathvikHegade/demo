import React from 'react';

export const ForgeLoader = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="relative w-24 h-24">
        {/* Anvil / Forge animation */}
        <div className="absolute inset-0 rounded-full border-t-2 border-forge-primary animate-spin"></div>
        <div className="absolute inset-3 border-r-2 border-forge-secondary rounded-full animate-spin direction-reverse" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 bg-forge-primary rounded-full shadow-[0_0_15px_#f97316] animate-pulse"></div>
        </div>
      </div>
      <p className="font-mono text-forge-primary text-sm uppercase tracking-widest animate-pulse">Forging Analytics...</p>
    </div>
  );
};