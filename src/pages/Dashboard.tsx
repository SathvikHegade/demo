import React, { useState } from 'react';
import { useAnalysisStore } from '../store/analysisStore';
import { ScoreRing } from '../components/ui/ScoreRing';
import { AIInsightCard } from '../components/ui/AIInsightCard';
import { ForgeLoader } from '../components/ui/ForgeLoader';
import { IssueCard } from '../components/ui/IssueCard';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import { BiasRadar } from '../components/charts/BiasRadar';
import { NoiseDonut } from '../components/charts/NoiseDonut';
import { ImbalanceBar } from '../components/charts/ImbalanceBar';
import { DuplicateGraph } from '../components/charts/DuplicateGraph';
import { CorrelationHeatmap } from '../components/charts/CorrelationHeatmap';
import { OutlierBoxPlot } from '../components/charts/OutlierBoxPlot';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export const Dashboard = () => {
  const { results, status, datasetName } = useAnalysisStore();
  const navigate = useNavigate();
  const { jobId } = useParams();
  const [activeTab, setActiveTab] = useState('Overview');

  if (status === 'idle') {
    navigate('/');
    return null;
  }

  if (status === 'uploading' || status === 'analyzing' || !results) {
    return (
      <div className="h-screen flex items-center justify-center">
        <ForgeLoader />
      </div>
    );
  }

  const { overview, bias, noise, duplicates, imbalance } = results;
  const tabs = ['Overview', 'Bias', 'Noise', 'Duplicates', 'Imbalance'];

  return (
    <div className="min-h-screen bg-forge-bg pb-20">
      <div className="bg-forge-surface border-b border-forge-border pt-24 pb-8 px-6">
        <div className="container mx-auto">
          <div className="flex justify-between items-end">
            <div>
              <p className="font-mono text-xs text-forge-secondary tracking-widest uppercase mb-1">Analysis Job: {jobId}</p>
              <h1 className="font-display font-bold text-3xl">{datasetName || "Dataset"} Analysis</h1>
            </div>
            <button onClick={() => navigate(`/report/${jobId}`)} className="flex items-center gap-2 border border-forge-primary text-forge-primary hover:bg-forge-primary hover:text-white px-4 py-2 font-mono text-sm rounded shadow-[0_0_10px_rgba(249,115,22,0.1)] hover:shadow-[0_0_15px_rgba(249,115,22,0.4)] transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Report
            </button>
          </div>
          
          <div className="flex space-x-8 mt-8 border-b border-forge-border">
            {tabs.map((tab) => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab)}
                className={`pb-3 font-mono relative uppercase text-sm tracking-wide transition-colors ${activeTab === tab ? 'text-forge-primary' : 'text-forge-muted hover:text-forge-text'}`}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div layoutId="underline" className="absolute left-0 right-0 bottom-[-1px] h-0.5 bg-forge-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'Overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Score */}
                <div className="forge-card p-8 flex flex-col items-center justify-center col-span-1 h-full">
                  <h3 className="font-display font-semibold mb-6 text-forge-text text-xl">DataForge Quality Score</h3>
                  <ScoreRing value={overview.dqs} size={220} stroke={12} label="DQS INDEX" />
                  <div className="w-full mt-10 grid grid-cols-2 gap-4">
                    <div className="bg-forge-bg p-3 rounded text-center border border-forge-border">
                      <span className="block text-xs font-mono text-forge-muted mb-1">Rows processed</span>
                      <span className="font-semibold text-lg">{overview.stats.rows.toLocaleString()}</span>
                    </div>
                    <div className="bg-forge-bg p-3 rounded text-center border border-forge-border">
                      <span className="block text-xs font-mono text-forge-muted mb-1">Processing time</span>
                      <span className="font-semibold text-lg text-forge-secondary">{overview.stats.time}</span>
                    </div>
                  </div>
                </div>

                {/* Right Column - Dimensions & Insights */}
                <div className="col-span-1 lg:col-span-2 space-y-6">
                  <AIInsightCard text={overview.summary} title="Claude Data Assessment" />
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    {[
                      {k: 'completeness', l: 'Complete'},
                      {k: 'uniqueness', l: 'Unique'},
                      {k: 'consistency', l: 'Consistent'},
                      {k: 'validity', l: 'Valid'}
                    ].map((dim) => (
                      <div key={dim.k} className="forge-card p-4 flex flex-col items-center">
                        <ScoreRing value={overview.dimensions[dim.k]} size={80} stroke={6} label={dim.l.toUpperCase()} />
                      </div>
                    ))}
                  </div>
                  
                  <div className="forge-card p-6 mt-4">
                    <h4 className="font-mono text-xs text-forge-muted uppercase tracking-wider mb-4 border-b border-forge-border pb-2">Severity Breakdown</h4>
                    <div className="h-6 w-full rounded-full overflow-hidden flex shadow-inner">
                        <div style={{ width: `${(overview.issues.critical / 39) * 100}%` }} className="bg-forge-critical h-full pl-2 text-[10px] text-white font-bold leading-6 flex items-center" title="Critical Issues" />
                        <div style={{ width: `${(overview.issues.warning / 39) * 100}%` }} className="bg-forge-warning h-full pl-2 text-[10px] text-white font-bold leading-6 flex items-center" title="Warnings" />
                        <div style={{ width: `${(overview.issues.info / 39) * 100}%` }} className="bg-forge-secondary h-full pl-2 text-[10px] text-white font-bold leading-6 flex items-center" title="Informational" />
                    </div>
                    <div className="flex justify-between mt-3 text-xs font-mono text-forge-muted">
                        <span className="flex items-center gap-1"><div className="w-3 h-3 bg-forge-critical rounded-sm"></div> Critical ({overview.issues.critical})</span>
                        <span className="flex items-center gap-1"><div className="w-3 h-3 bg-forge-warning rounded-sm"></div> Warnings ({overview.issues.warning})</span>
                        <span className="flex items-center gap-1"><div className="w-3 h-3 bg-forge-secondary rounded-sm"></div> Info ({overview.issues.info})</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Bias' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="forge-card p-6">
                  <h3 className="font-display font-semibold mb-4 text-forge-primary">Fairness Radar</h3>
                  <BiasRadar />
                </div>
                <div className="forge-card p-6">
                  <h3 className="font-display font-semibold mb-4 text-forge-secondary">Correlation Heatmap</h3>
                  <CorrelationHeatmap />
                </div>
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-semibold text-forge-text">Detected Anomalies</h3>
                    <label className="flex items-center gap-2 cursor-pointer font-mono text-sm text-forge-muted">
                       <input type="checkbox" className="accent-forge-secondary bg-forge-bg border-forge-border" defaultChecked /> Show Sensitive Column Data
                    </label>
                  </div>
                  {bias.map((b: any, i: number) => (
                    <IssueCard 
                      key={i}
                      title={`Bias Flag: ${b.column}`}
                      severity={b.severity}
                      description={`Detected disparity of ${(b.disparity * 100).toFixed(1)}% using ${b.metric}.`}
                      recommendation={`Rebalancing via SMOTE on ${b.column} recommended to minimize parity impact before modeling.`}
                    />
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'Noise' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="forge-card p-6 col-span-1">
                  <h3 className="font-display font-semibold text-forge-primary mb-4">Noise Breakdown</h3>
                  <NoiseDonut data={noise} />
                  <div className="mt-8 space-y-3 font-mono text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#f97316]">Outliers</span>
                      <span className="text-forge-text">{noise.outliers.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#eab308]">Type Mismatches</span>
                      <span className="text-forge-text">{noise.typeMismatch.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#a855f7]">Value Noise</span>
                      <span className="text-forge-text">{noise.valueNoise.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="col-span-2 space-y-6">
                  <div className="forge-card p-6">
                    <h3 className="font-display font-semibold mb-4 text-forge-text">Statistical Distribution Bounds</h3>
                    <OutlierBoxPlot />
                    <p className="text-center font-mono text-xs text-forge-muted mt-2">D3.js Median Absolute Deviation Boundaries</p>
                  </div>
                  <div>
                    <h3 className="font-display font-semibold mb-4 text-forge-text">Recommended Fixes</h3>
                    <IssueCard 
                      title="Numerical Formats in Strings"
                      severity="Warning"
                      description={`Found ${noise.typeMismatch} distinct mismatches containing monetary symbols inside numeric columns.`}
                      recommendation="Run `.replace('$', '', regex=True)` and force type to float64, otherwise tree regressors will crash."
                    />
                    <IssueCard 
                      title="Extreme Tail Bounds"
                      severity="Critical"
                      description={`Located ${noise.outliers} points failing the modified Median Absolute Deviation (MAD) envelope.`}
                      recommendation="Apply robust scaling or cap the 99th percentile, due to significant deviation in column 'Age'."
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Imbalance' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="forge-card p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-display text-xl font-bold text-forge-primary">Class Distributions</h3>
                    <SeverityBadge level={imbalance.severity} />
                  </div>
                  <div className="text-sm font-mono text-forge-muted mb-4 border-b border-forge-border pb-4">
                    <p className="flex justify-between bg-[#111118] p-2 mt-2 border border-forge-border"><span>Target:</span> <span className="text-forge-text">{imbalance.target}</span></p>
                    <p className="flex justify-between bg-[#111118] p-2 mt-2 border border-forge-border"><span>Entropy:</span> <span className="text-forge-secondary">{imbalance.entropy.toFixed(2)}</span></p>
                  </div>
                  <ImbalanceBar />
                </div>
                <div className="space-y-4">
                  <AIInsightCard 
                    title="Data Drift Vulnerability" 
                    text={`Based on the minority class ratio scaling (${imbalance.ratio}), the 'Churn' parameter carries significant risk of failing under production inference if drift occurs. The algorithm recommends generating synthetic rows using SMOTE targeting the structural distribution.`}
                  />
                </div>
              </div>
            )}

            {activeTab === 'Duplicates' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="forge-card p-6 flex flex-col items-center justify-center">
                   <h3 className="font-display font-semibold mb-4 text-forge-primary">Duplicate Clusters Graph</h3>
                   <DuplicateGraph />
                   <p className="text-center font-mono text-xs text-forge-muted mt-4">Force Directed Node Link (D3.js)</p>
                </div>
                <div className="forge-card p-6 flex flex-col">
                   <h3 className="font-display font-semibold mb-4 text-forge-text border-b border-forge-border pb-4">Duplicate Report</h3>
                   <div className="flex-1 overflow-y-auto pr-2">
                       <ul className="space-y-4 font-mono text-sm">
                           {duplicates.map((d: any, idx: number) => (
                             <li key={idx} className="bg-forge-bg border border-forge-border p-4 rounded flex flex-col justify-between">
                                <div className="flex justify-between mb-2">
                                  <span className="text-forge-secondary font-bold text-xs uppercase tracking-wider">Cluster #{d.group}</span>
                                  <span className="text-forge-success">{d.matchRate} Match</span>
                                </div>
                                <span className="text-forge-muted mb-3 break-words text-xs">Identical records on index: [{d.indices.join(", ")}]</span>
                                <button className="text-xs bg-forge-primary hover:bg-orange-600 text-white rounded px-2 py-1 w-full tracking-wider transition uppercase">{d.action}</button>
                             </li>
                           ))}
                       </ul>
                   </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};