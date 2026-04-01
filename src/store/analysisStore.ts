import { create } from 'zustand';

interface AnalysisState {
  currentJobId: string | null;
  datasetName: string | null;
  status: 'idle' | 'uploading' | 'analyzing' | 'complete' | 'error';
  results: any | null;
  setJob: (id: string, name: string) => void;
  setStatus: (status: 'idle' | 'uploading' | 'analyzing' | 'complete' | 'error') => void;
  loadMockData: () => void;
}

const mockData = {
  overview: {
    dqs: 76.5,
    dimensions: {
      completeness: 92,
      uniqueness: 85,
      consistency: 65,
      validity: 64,
      balance: 88
    },
    stats: { rows: 25430, cols: 24, size: '8.2 MB', time: '1m 24s' },
    summary: "The dataset shows promising completeness (92%) and acceptable uniqueness (85%), but suffers significantly from consistency issues (65%) and outlier validity (64%), dragging the DQS down to 76.5. Resolving the formatting noise in the 'Revenue' and 'Age' fields yields the highest immediate return on fixing efforts.",
    issues: { critical: 3, warning: 12, info: 24 }
  },
  bias: [
    { column: "Gender", disparity: 0.14, metric: "Statistical Parity Difference", severity: "Warning" }
  ],
  noise: {
    outliers: 1205,
    typeMismatch: 450,
    valueNoise: 3420,
    structural: 0
  },
  duplicates: [
    { group: 1, indices: [23, 405], matchRate: "100%", action: "Drop Rows" }
  ],
  imbalance: {
    target: "Churn",
    ratio: "4.2:1",
    severity: "MODERATE",
    entropy: 0.81,
    recommendation: "Apply SMOTE to synthesize minority class samples."
  }
};

export const useAnalysisStore = create<AnalysisState>((set: any) => ({
  currentJobId: null,
  datasetName: null,
  status: 'idle',
  results: null,
  setJob: (id: string, name: string) => set({ currentJobId: id, datasetName: name, status: 'uploading' }),
  setStatus: (status: any) => set({ status }),
  loadMockData: () => {
    set({ status: 'analyzing' });
    setTimeout(() => {
      set({ status: 'complete', results: mockData });
    }, 2000);
  }
}));
