/**
 * analysisStore.js — Zustand global state.
 * FIXED: replaced mock-only logic with real API calls.
 *        Added polling loop (every 2s) until status === "complete".
 *        Real report from backend is stored in results.
 */
import { create } from 'zustand';
import { startAnalysis, getReport } from '../services/api';

// ── Mock data for demo tiles (no file needed) ────────────────────────────────
const MOCK_REPORT = {
  job_id: 'demo-mock-001',
  status: 'complete',
  dataset_info: {
    rows: 25430,
    columns: 24,
    size_mb: 8.2,
    size_kb: 8396.8,
    column_names: ['age','gender','income','category','score','id','email','notes'],
    dtypes: {},
    missing_summary: { age: 0.15, income: 0.02 },
  },
  overall_quality_score: 76.5,
  grade: 'C',
  executive_summary:
    "The dataset shows promising completeness (92%) and acceptable uniqueness (85%), but suffers significantly from consistency issues (65%) and outlier validity (64%), dragging the DQS down to 76.5. Resolving the formatting noise in the 'Revenue' and 'Age' fields yields the highest immediate return. Three critical bias flags were detected in the gender column (80/20 split). Immediate SMOTE rebalancing is recommended before any model training.",
  issues: [
    {
      id: 'bias_gender_001',
      category: 'bias',
      severity: 'CRITICAL',
      column: 'gender',
      description: 'The gender column shows an 80/20 male/female split, indicating significant demographic bias.',
      metric_value: 0.8,
      recommendation: 'Apply SMOTE or re-sample to achieve a more balanced gender distribution.',
      estimated_impact: 'Models trained on this data will likely underperform for female-identifying users.',
    },
    {
      id: 'noise_age_001',
      category: 'noise',
      severity: 'CRITICAL',
      column: 'age',
      description: '5 extreme outliers found with age > 200, indicating data entry errors.',
      metric_value: 0.01,
      recommendation: 'Cap age values at 99th percentile (approx 85) using IQR winsorisation.',
      estimated_impact: 'Tree-based models will create spurious splits on these extreme values.',
    },
    {
      id: 'imbalance_score_001',
      category: 'imbalance',
      severity: 'WARNING',
      column: 'score',
      description: 'Target column "score" has a 90/10 class split, which is severe imbalance.',
      metric_value: 9.0,
      recommendation: 'Use SMOTE oversampling on minority class before training.',
      estimated_impact: 'Classifier will default to majority class, yielding ~90% accuracy but 0% recall on minority.',
    },
  ],
  dimension_scores: {
    completeness: 92,
    uniqueness: 85,
    consistency: 65,
    validity: 64,
    balance: 88,
  },
  bias_report: {
    overall_bias_score: 45,
    affected_columns: ['gender'],
    details: [
      {
        column: 'gender',
        bias_type: 'demographic',
        dominant_value: 'male',
        dominant_fraction: 0.8,
        bias_score: 45,
        disparate_impact_ratio: 0.62,
        statistical_parity_diff: -0.14,
        is_proxy: false,
      },
    ],
    fairness_metrics: { gender: { DIR: 0.62, SPD: -0.14 } },
  },
  noise_report: {
    missing_value_columns: ['age', 'income'],
    total_missing_cells: 1205,
    missing_fraction: 0.08,
    outlier_details: [
      { column: 'age', outlier_count: 5, outlier_fraction: 0.01, lower_bound: -5, upper_bound: 120 },
      { column: 'income', outlier_count: 450, outlier_fraction: 0.018, lower_bound: 0, upper_bound: 250000 },
    ],
    formatting_errors: { income: 450 },
    constant_columns: [],
    high_cardinality_columns: ['email'],
  },
  duplicate_report: {
    exact_duplicate_rows: 30,
    exact_duplicate_fraction: 0.06,
    near_duplicate_pairs: 12,
    duplicate_columns: [],
  },
  imbalance_report: {
    target_column: 'score',
    class_distribution: [
      { label: '0', count: 22887, fraction: 0.9 },
      { label: '1', count: 2543, fraction: 0.1 },
    ],
    imbalance_ratio: 9.0,
    is_imbalanced: true,
    recommended_strategy: 'SMOTE oversampling or cost-sensitive learning (class_weight=\'balanced\')',
  },
  nlp_report: { text_columns_analyzed: ['notes', 'email'], details: [] },
  generated_at: new Date().toISOString(),
};

// ── Store ─────────────────────────────────────────────────────────────────────
export const useAnalysisStore = create((set, get) => ({
  currentJobId: null,
  datasetName: null,
  status: 'idle',
  progress: 0,
  stage: '',
  results: null,
  errorMessage: null,

  uploadFile: async (file, config = {}) => {
    set({ status: 'uploading', datasetName: file.name, progress: 0, stage: 'Uploading', errorMessage: null });
    try {
      const job = await startAnalysis(file, config);
      set({ currentJobId: job.job_id, status: 'analyzing', progress: 0.05, stage: 'Queued' });
      get().pollJob(job.job_id);
    } catch (err) {
      set({ status: 'error', errorMessage: err.message });
    }
  },

  pollJob: (jobId) => {
    // Poll every 2 seconds until status === "complete"
    const interval = setInterval(async () => {
      try {
        const data = await getReport(jobId);
        if (data.status === 'complete') {
          clearInterval(interval);
          set({ status: 'complete', results: data, progress: 1, stage: 'Done' });
        } else if (data.status === 'failed') {
          clearInterval(interval);
          set({ status: 'error', errorMessage: data.message || 'Analysis failed' });
        } else {
          // Still processing
          set({ progress: data.progress ?? 0, stage: data.stage ?? 'Analysing…' });
        }
      } catch (err) {
        clearInterval(interval);
        set({ status: 'error', errorMessage: err.message });
      }
    }, 2000);
  },

  // Called after a successful import (sheets/kaggle/hf) that returns a job_id
  startImportJob: (jobId, label = 'Imported Dataset') => {
    set({
      currentJobId: jobId,
      datasetName: label,
      status: 'analyzing',
      progress: 0.05,
      stage: 'Queued',
      results: null,
      errorMessage: null,
    });
    get().pollJob(jobId);
  },

  reset: () =>
    set({
      currentJobId: null,
      datasetName: null,
      status: 'idle',
      progress: 0,
      stage: '',
      results: null,
      errorMessage: null,
    }),

  // Demo mode — loads mock data without calling the backend
  loadMockData: () => {
    set({ status: 'analyzing', datasetName: 'demo_dirty.csv', progress: 0.1, stage: 'Loading…' });
    setTimeout(() => {
      set({
        status: 'complete',
        results: MOCK_REPORT,
        currentJobId: 'demo-mock-001',
        progress: 1,
        stage: 'Done',
      });
    }, 1800);
  },
}));