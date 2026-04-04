/**
 * cleaningStore.js — Zustand store for the Data Cleaning feature.
 * Manages file upload, job polling, config, and results.
 */
import { create } from "zustand";
import {
  startCleaning,
  getCleaningStatus,
  getCleaningDownloadUrl,
} from "../services/api";

export const useCleaningStore = create((set, get) => ({
  // ── State ──────────────────────────────────────────────────────────────────
  status: "idle", // idle | uploading | processing | complete | error
  jobId: null,
  progress: 0,
  stage: "",
  fileName: null,
  report: null,
  errorMessage: null,
  downloadUrl: null,

  // ── Config ─────────────────────────────────────────────────────────────────
  config: {
    remove_exact_duplicates: true,
    remove_fuzzy_duplicates: true,
    fuzzy_threshold: 0.9,
    impute_missing: true,
    imputation_strategy: "median",
    handle_outliers: true,
    outlier_method: "iqr",
    cap_outliers: true,
    iqr_multiplier: 1.5,
    zscore_threshold: 3.0,
    infer_types: true,
    apply_type_conversions: true,
  },

  setConfig: (updates) => set((s) => ({ config: { ...s.config, ...updates } })),

  // ── Actions ────────────────────────────────────────────────────────────────
  cleanFromFile: async (file) => {
    const { config } = get();
    set({
      status: "processing",
      fileName: file.name,
      progress: 0.02,
      stage: "Uploading to cleaner",
      errorMessage: null,
      report: null,
      downloadUrl: null,
    });
    try {
      const job = await startCleaning(file, config);
      set({ jobId: job.job_id, progress: 0.05, stage: "Queued" });
      get().pollCleaning(job.job_id);
    } catch (err) {
      set({ status: "error", errorMessage: err.message });
    }
  },

  uploadAndClean: async (file) => {
    const { config } = get();
    set({
      status: "uploading",
      fileName: file.name,
      progress: 0,
      stage: "Uploading",
      errorMessage: null,
      report: null,
      downloadUrl: null,
    });
    try {
      const job = await startCleaning(file, config);
      set({ jobId: job.job_id, status: "processing", progress: 0.05, stage: "Queued" });
      get().pollCleaning(job.job_id);
    } catch (err) {
      set({ status: "error", errorMessage: err.message });
    }
  },

  pollCleaning: (jobId) => {
    // Poll every 2 seconds — backend is doing real work, no need to hammer
    const interval = setInterval(async () => {
      try {
        const data = await getCleaningStatus(jobId);

        if (data.status === "complete" && data.report) {
          // Backend wraps finished report as { status: "complete", report: {...} }
          clearInterval(interval);
          const report = data.report;
          const url = report.download_token
            ? getCleaningDownloadUrl(report.download_token)
            : null;
          set({ status: "complete", report, progress: 1, stage: "Done", downloadUrl: url });

        } else if (data.status === "failed" || (typeof data === "string" && data.startsWith("failed"))) {
          clearInterval(interval);
          set({ status: "error", errorMessage: data.message || "Cleaning failed" });

        } else {
          // Still processing
          set({ progress: data.progress ?? 0, stage: data.stage ?? "Processing…" });
        }
      } catch (err) {
        clearInterval(interval);
        set({ status: "error", errorMessage: err.message });
      }
    }, 2000);
  },

  reset: () =>
    set({
      status: "idle",
      jobId: null,
      progress: 0,
      stage: "",
      fileName: null,
      report: null,
      errorMessage: null,
      downloadUrl: null,
    }),
}));
