import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysisStore } from '../store/analysisStore';

export const Landing = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [depth, setDepth] = useState('Standard (2min)');
  const navigate = useNavigate();
  const { setJob, loadMockData } = useAnalysisStore();

  const handleUpload = () => {
    const fakeId = "df-" + Math.random().toString(36).substr(2, 9);
    setJob(fakeId, "Customer_Churn_2026.csv");
    navigate(`/dashboard/${fakeId}`);
    loadMockData(); // Simulate processing time & result mock mapping
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-12">
      <div className="max-w-3xl space-y-6">
        <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight leading-tight">
          Forge <span className="text-gradient">Production-Ready</span> Datasets.
        </h1>
        <p className="font-body text-forge-muted text-lg md:text-xl max-w-2xl mx-auto border-l-4 border-forge-secondary pl-4">
          Advanced analytics core for detecting bias, structural noise, duplication, and imbalance. Drop your data into the forge and extract pristine ML-ready fuel.
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <div 
          className={`w-full mt-8 p-1 rounded-2xl transition-all duration-500 ease-out bg-gradient-to-r ${
            isHovered ? 'from-forge-primary to-forge-secondary shadow-[0_0_40px_rgba(249,115,22,0.2)]' : 'from-forge-border to-forge-border'
          }`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onDragEnter={() => setIsHovered(true)}
          onDragLeave={() => setIsHovered(false)}
        >
          <div className="bg-forge-surface rounded-xl p-16 flex flex-col items-center justify-center border border-forge-bg shadow-inner cursor-pointer" onClick={handleUpload}>
            <div className={`p-4 rounded-full bg-forge-bg mb-6 transition-transform ${isHovered ? 'scale-110' : ''}`}>
              <svg className={`w-10 h-10 ${isHovered ? 'text-forge-primary animate-pulse' : 'text-forge-muted'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="font-display font-semibold text-2xl text-forge-text mb-2">Drag & Drop Dataset</h3>
            <p className="font-mono text-sm text-forge-muted mb-8">CSV, JSON, XLSX or URL</p>

            <button className="bg-forge-bg hover:bg-forge-primary hover:text-white border border-forge-primary text-forge-primary transition-all font-mono px-8 py-3 rounded uppercase text-sm tracking-widest shadow-[0_0_15px_rgba(249,115,22,0)] hover:shadow-[0_0_20px_rgba(249,115,22,0.4)]">
              Select File
            </button>
          </div>
        </div>

        {/* Collapsible Config Panel */}
        <div className="mt-4 text-left">
          <button onClick={() => setConfigOpen(!configOpen)} className="font-mono text-xs text-forge-muted hover:text-forge-secondary flex items-center transition">
            <svg className={`w-3 h-3 mr-2 transform transition-transform ${configOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            ADVANCED CONFIGURATION
          </button>
          
          {configOpen && (
            <div className="mt-4 bg-forge-surface border border-forge-border p-4 rounded-lg font-mono text-sm grid grid-cols-2 gap-6 animate-[pulseBorder_3s_ease-in-out_infinite]">
               <div>
                  <label className="block text-forge-muted mb-1 text-xs">Target Column (Optional)</label>
                  <input type="text" placeholder="e.g. Churn" className="w-full bg-[#0a0a0f] border border-forge-border p-2 rounded text-forge-secondary focus:outline-none focus:border-forge-primary" />
               </div>
               <div>
                  <label className="block text-forge-muted mb-1 text-xs">Analysis Depth</label>
                  <select value={depth} onChange={(e) => setDepth(e.target.value)} className="w-full bg-[#0a0a0f] border border-forge-border p-2 rounded text-forge-secondary focus:outline-none focus:border-forge-primary">
                    <option>Quick (30s)</option>
                    <option>Standard (2min)</option>
                    <option>Deep (5min)</option>
                  </select>
               </div>
               <div className="col-span-2">
                  <label className="block text-forge-muted mb-1 text-xs">Bias Tolerance Slider (0.0 to 1.0)</label>
                  <input type="range" min="0" max="100" defaultValue="15" className="w-full accent-forge-primary bg-[#0a0a0f] h-2 rounded-lg cursor-pointer" />
               </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex gap-6 mt-10">
         <div className="text-left bg-forge-surface p-4 rounded-lg border border-forge-border hover:border-forge-secondary shadow-md cursor-pointer" onClick={handleUpload}>
            <p className="font-mono text-xs text-forge-secondary">DEMO DATASET</p>
            <h4 className="font-body font-bold mt-1 text-sm">E-commerce Churn (Dirty)</h4>
         </div>
         <div className="text-left bg-forge-surface p-4 rounded-lg border border-forge-border hover:border-forge-success shadow-md cursor-pointer" onClick={handleUpload}>
            <p className="font-mono text-xs text-forge-success">DEMO DATASET</p>
            <h4 className="font-body font-bold mt-1 text-sm">Credit Fraud (Imbalanced)</h4>
         </div>
      </div>

    </div>
  );
};