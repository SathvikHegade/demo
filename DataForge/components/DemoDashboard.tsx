import { useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { mapReportToDemoFormat } from '../utils/mapReport';
import { ScoreRing } from './ui/ScoreRing';
import { AIInsightCard } from './ui/AIInsightCard';
import { IssueCard } from './ui/IssueCard';
import { SeverityBadge } from './ui/SeverityBadge';
import { BiasRadar } from './charts/BiasRadar';
import { NoiseDonut } from './charts/NoiseDonut';
import { ImbalanceBar } from './charts/ImbalanceBar';
import { DuplicateGraph } from './charts/DuplicateGraph';
import { CorrelationHeatmap } from './charts/CorrelationHeatmap';
import { OutlierBoxPlot } from './charts/OutlierBoxPlot';

const TABS = ['Overview', 'Bias', 'Noise', 'Duplicates', 'Imbalance'] as const;

type Tab = (typeof TABS)[number];

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px' }}>
    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#7a7a9a', marginBottom: 6 }}>{label}</div>
    <div style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 18, color: '#f0f0f8' }}>{value}</div>
  </div>
);

const Card = ({ children }: { children: ReactNode }) => (
  <div style={{ background: '#080810', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>{children}</div>
);

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function getDimension(report: any, name: string): any {
  const dims = report?.result?.dimensions;
  return Array.isArray(dims) ? dims.find((d) => d?.name === name) : undefined;
}

function computeEdaMetrics(report: any): {
  completeness: number;
  consistency: number;
  validity: number;
  uniqueness: number;
} {
  const noise = getDimension(report, 'noise');
  const duplication = getDimension(report, 'duplication');

  const avgMissing = Number(noise?.metrics?.avg_missing ?? 0);
  const avgRowMissing = Number(noise?.metrics?.avg_row_missing_ratio ?? avgMissing ?? 0);
  const avgOutlierRate = Number(noise?.metrics?.avg_outlier_rate ?? 0);
  const exactDupRatio = Number(duplication?.metrics?.exact_duplicate_ratio ?? 0);

  const completeness = (1 - clamp01(avgMissing)) * 100;
  const consistency = (1 - clamp01(avgRowMissing)) * 100;
  const validity = (1 - clamp01(avgOutlierRate)) * 100;
  const uniqueness = (1 - clamp01(exactDupRatio)) * 100;

  return {
    completeness: Number.isFinite(completeness) ? completeness : 0,
    consistency: Number.isFinite(consistency) ? consistency : 0,
    validity: Number.isFinite(validity) ? validity : 0,
    uniqueness: Number.isFinite(uniqueness) ? uniqueness : 0,
  };
}

function downloadPdfReport(report: any) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 48;
  const right = pageW - 48;
  const top = 56;
  const bottom = pageH - 56;

  const jobId = String(report?.job_id ?? '');
  const sourceFilename = String(report?.source_filename ?? report?.filename ?? 'dataset.csv');
  const generatedAt = report?.generated_at ? new Date(String(report.generated_at)) : new Date();
  const datasetSizeBytes = Number(report?.dataset_size_bytes ?? NaN);
  const datasetSizeMb = Number.isFinite(datasetSizeBytes) ? datasetSizeBytes / (1024 * 1024) : NaN;

  const qualityReport = report?.quality_report;
  const qrCore = qualityReport?.core_metrics;
  const qrDims = qualityReport?.quality_dimensions;

  const qualityScore = Number(report?.result?.quality_score ?? qrCore?.overall_score ?? NaN);
  const rows = Number(qrCore?.rows ?? report?.result?.dataset_summary?.rows ?? NaN);
  const cols = Number(qrCore?.columns ?? report?.result?.dataset_summary?.columns ?? NaN);

  const imbalanceDim = getDimension(report, 'imbalance');
  const balance = Number(qrDims?.balance ?? imbalanceDim?.score ?? report?.result?.score_breakdown?.imbalance ?? NaN);

  const fallbackDims = computeEdaMetrics(report);
  const completeness = Number(qrDims?.completeness ?? fallbackDims.completeness);
  const uniqueness = Number(qrDims?.uniqueness ?? fallbackDims.uniqueness);
  const consistency = Number(qrDims?.consistency ?? fallbackDims.consistency);
  const validity = Number(qrDims?.validity ?? fallbackDims.validity);

  const executiveSummary = String(qualityReport?.executive_summary ?? report?.ai_report?.executive_summary ?? 'Summary unavailable.');
  const poweredBy = String(report?.ai_report?.powered_by ?? report?.ai_report?.model ?? 'deterministic');

  type PdfIssue = {
    issue_id: string;
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    description: string;
    recommendation: string;
  };

  const issues: PdfIssue[] = [];

  // Prefer server-provided quality_report issues (Gemini/deterministic) when present.
  const qrIssuesRaw = Array.isArray(qualityReport?.issues) ? qualityReport.issues : null;
  if (qrIssuesRaw) {
    for (const it of qrIssuesRaw) {
      const issueId = String(it?.issue_id ?? it?.id ?? 'issue_001');
      const sevRaw = String(it?.severity ?? 'INFO').toUpperCase();
      const severity: PdfIssue['severity'] = sevRaw === 'CRITICAL' ? 'CRITICAL' : sevRaw === 'WARNING' ? 'WARNING' : 'INFO';
      const desc = String(it?.description ?? it?.title ?? 'Issue detected.');
      const rec = String(it?.recommendation ?? '→ Review and apply targeted cleaning for the flagged issue.');
      issues.push({ issue_id: issueId, severity, description: desc, recommendation: rec });
    }
  }

  if (!qrIssuesRaw) {
    const dims = report?.result?.dimensions;
    const allDims = Array.isArray(dims) ? dims : [];

    // Always include a missing-values summary issue.
    const noise = getDimension(report, 'noise');
    const missingByCol = noise?.metrics?.missing_ratio_by_column;
    const avgMissing = Number(noise?.metrics?.avg_missing ?? 0);
    if (missingByCol && typeof missingByCol === 'object') {
      const colsWithMissing = Object.entries(missingByCol as Record<string, unknown>)
        .map(([k, v]) => [k, Number(v)] as const)
        .filter(([, v]) => Number.isFinite(v) && v > 0)
        .sort((a, b) => b[1] - a[1]);
      if (colsWithMissing.length > 0) {
        const pct = clamp01(avgMissing) * 100;
        const topCols = colsWithMissing.slice(0, 5).map(([k]) => `'${k}'`).join(', ');
        issues.push({
          issue_id: 'missing_values_001',
          severity: pct >= 20 ? 'CRITICAL' : pct >= 10 ? 'WARNING' : 'INFO',
          description: `Approximately ${pct.toFixed(2)}% of values are missing across ${colsWithMissing.length} columns: ${topCols}${colsWithMissing.length > 5 ? ', ...' : ''}.`,
          recommendation:
            '→ For numeric columns, consider median imputation or dropping highly-missing rows. For identifiers, investigate root cause; if uniqueness is required, drop or fix conflicting rows. For categorical columns, use mode imputation or treat missing as a separate category.',
        });
      }
    }

    // Add outlier issues per numeric column (derived from noise metrics).
    const outlierRates = noise?.metrics?.outlier_rate_by_numeric_column;
    if (outlierRates && typeof outlierRates === 'object') {
      const items = Object.entries(outlierRates as Record<string, unknown>)
        .map(([k, v]) => [k, Number(v)] as const)
        .filter(([, v]) => Number.isFinite(v) && v > 0)
        .sort((a, b) => b[1] - a[1]);
      for (const [col, rate] of items.slice(0, 4)) {
        const pct = clamp01(rate) * 100;
        if (pct < 5) continue;
        issues.push({
          issue_id: `outliers_${String(col).toLowerCase()}_001`,
          severity: pct >= 15 ? 'CRITICAL' : pct >= 8 ? 'WARNING' : 'INFO',
          description: `The '${col}' column exhibits outliers (${pct.toFixed(2)}% by IQR rule). Extreme values can distort statistics and model training.`,
          recommendation:
            '→ Investigate obvious entry errors. Consider IQR capping / Winsorization for upper/lower tails, or robust scaling. For small datasets, manual review is recommended.',
        });
      }
    }

    // Pull alerts from backend dimensions for additional issues.
    let alertCounter = 1;
    for (const d of allDims) {
      const alerts = Array.isArray(d?.alerts) ? d.alerts : [];
      for (const a of alerts) {
        const sev = String(a?.severity ?? '').toLowerCase();
        const severity: PdfIssue['severity'] = sev === 'critical' ? 'CRITICAL' : sev === 'warn' ? 'WARNING' : 'INFO';
        const dimension = String(a?.dimension ?? d?.name ?? 'dimension');
        const metricKey = String(a?.metric_key ?? 'metric');
        const id = `${dimension}_${metricKey}`.replace(/[^a-zA-Z0-9_\.]/g, '_');

        const baseRec =
          dimension === 'duplication'
            ? '→ Remove exact duplicates, then inspect near-duplicate clusters. If duplicates are expected, de-duplicate on a stable primary key.'
            : dimension === 'bias'
              ? '→ Review sensitive group splits; consider stratified sampling, reweighting, or collecting more balanced data.'
              : dimension === 'imbalance'
                ? '→ Apply class weighting, over-sampling of minority class, or collect more samples for rare classes.'
                : dimension === 'noise'
                  ? '→ Prioritize columns with the highest missing/outlier rates; clean formats and standardize types.'
                  : '→ Review and apply targeted cleaning for the flagged metric.';

        issues.push({
          issue_id: `${id}_${String(alertCounter).padStart(3, '0')}`,
          severity,
          description: String(a?.message ?? 'Issue detected.'),
          recommendation: baseRec,
        });
        alertCounter += 1;
      }
    }
  }

  // De-duplicate by issue_id
  const seen = new Set<string>();
  const uniqueIssues = issues.filter((i) => {
    if (seen.has(i.issue_id)) return false;
    seen.add(i.issue_id);
    return true;
  });

  const severityColor = (sev: PdfIssue['severity']) => {
    if (sev === 'CRITICAL') return { r: 230, g: 72, b: 77 };
    if (sev === 'WARNING') return { r: 242, g: 169, b: 0 };
    return { r: 47, g: 191, b: 113 };
  };

  const ensureSpace = (y: number, needed: number) => {
    if (y + needed <= bottom) return y;
    doc.addPage();
    return top;
  };

  const drawHex = (x: number, y: number, size: number) => {
    const pts = [
      [x + size * 0.5, y],
      [x + size, y + size * 0.28],
      [x + size, y + size * 0.78],
      [x + size * 0.5, y + size * 1.06],
      [x, y + size * 0.78],
      [x, y + size * 0.28],
    ];
    doc.setDrawColor(122, 90, 248);
    doc.setLineWidth(1.2);
    doc.lines(
      pts.slice(1).map((p, idx) => [p[0] - pts[idx][0], p[1] - pts[idx][1]]),
      pts[0][0],
      pts[0][1]
    );
    doc.line(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1]);
  };

  const addFooter = (pageNum: number) => {
    doc.setFontSize(9);
    doc.setTextColor(130);
    const stamp = `Generated by DataForge · Powered by ${poweredBy} · ${generatedAt.toISOString()}`;
    doc.text(stamp, left, pageH - 28);
    doc.text(String(pageNum), right, pageH - 28, { align: 'right' });
    doc.setTextColor(0);
  };

  // Page 1 — header and summary
  let y = top;
  drawHex(left, y - 20, 16);
  doc.setFontSize(22);
  doc.setTextColor(20);
  doc.text('DataForge Quality Report', left + 26, y);

  y += 18;
  doc.setFontSize(12);
  doc.setTextColor(80);
  doc.text(sourceFilename, left + 26, y);

  y += 16;
  doc.setFontSize(10);
  doc.text(`Job ref: ${jobId || '-'}`, left + 26, y);
  doc.text(generatedAt.toLocaleDateString(), right, y, { align: 'right' });
  doc.setTextColor(0);

  y += 18;
  doc.setDrawColor(210);
  doc.line(left, y, right, y);

  // 1 · Executive Summary
  y += 28;
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text('1 · Executive Summary', left, y);

  y += 14;
  doc.setFontSize(10);
  doc.setTextColor(50);
  const summaryText = doc.splitTextToSize(`"${executiveSummary}"`, right - left);
  doc.text(summaryText, left, y);
  y += summaryText.length * 12;

  // 2 · Core Metrics
  y = ensureSpace(y, 140);
  y += 18;
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text('2 · Core Metrics', left, y);

  y += 14;
  const boxY = y;
  const boxH = 56;
  const gap = 10;
  const boxW = (right - left - gap * 3) / 4;
  const boxes = [
    { label: 'Rows', value: Number.isFinite(rows) ? rows.toLocaleString() : '-' },
    { label: 'Columns', value: Number.isFinite(cols) ? String(cols) : '-' },
    { label: 'Size', value: Number.isFinite(datasetSizeMb) ? `${datasetSizeMb.toFixed(1)} MB` : '-' },
    { label: 'Score', value: Number.isFinite(qualityScore) ? `${qualityScore.toFixed(1)}/100` : '-' },
  ];
  for (let i = 0; i < boxes.length; i += 1) {
    const x = left + i * (boxW + gap);
    doc.setDrawColor(220);
    doc.setFillColor(248, 248, 252);
    doc.roundedRect(x, boxY, boxW, boxH, 8, 8, 'FD');
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(boxes[i].label, x + 10, boxY + 18);
    doc.setFontSize(14);
    doc.setTextColor(30);
    doc.text(String(boxes[i].value), x + 10, boxY + 40);
  }
  doc.setTextColor(0);
  y = boxY + boxH;

  // 3 · Quality Dimensions
  y = ensureSpace(y, 160);
  y += 26;
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text('3 · Quality Dimensions', left, y);
  y += 14;

  const dimBoxes = [
    { label: 'completeness', value: completeness },
    { label: 'uniqueness', value: uniqueness },
    { label: 'consistency', value: consistency },
    { label: 'validity', value: validity },
    { label: 'balance', value: Number.isFinite(balance) ? balance : 100 },
  ];

  const dimBoxW = (right - left - gap * 4) / 5;
  const dimBoxH = 62;
  const dimY = y;
  for (let i = 0; i < dimBoxes.length; i += 1) {
    const x = left + i * (dimBoxW + gap);
    const val = Math.max(0, Math.min(100, Number(dimBoxes[i].value ?? 0)));
    doc.setDrawColor(220);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, dimY, dimBoxW, dimBoxH, 8, 8, 'FD');
    doc.setFontSize(16);
    doc.setTextColor(30);
    doc.text(String(Math.round(val)), x + dimBoxW / 2, dimY + 30, { align: 'center' });
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(dimBoxes[i].label, x + dimBoxW / 2, dimY + 50, { align: 'center' });
  }
  doc.setTextColor(0);
  y = dimY + dimBoxH;

  // 4 · Issues
  const issuesStartOnNextPage = uniqueIssues.length > 0;
  if (issuesStartOnNextPage) {
    addFooter(1);
    doc.addPage();
    y = top;
  } else {
    y = ensureSpace(y, 80);
    y += 24;
  }

  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text(`4 · Issues (${uniqueIssues.length})`, left, y);
  y += 14;

  doc.setFontSize(10);
  doc.setTextColor(40);

  const startPage = doc.getNumberOfPages();
  let currentPage = startPage;

  for (const issue of uniqueIssues) {
    y = ensureSpace(y, 90);
    if (y === top && doc.getNumberOfPages() !== currentPage) {
      addFooter(currentPage);
      currentPage = doc.getNumberOfPages();
    }

    // Issue header line: id + severity badge
    doc.setFontSize(10);
    doc.setTextColor(20);
    doc.text(issue.issue_id, left, y);

    const badgeText = issue.severity;
    const badgeW = Math.max(52, doc.getTextWidth(badgeText) + 16);
    const badgeH = 14;
    const badgeX = right - badgeW;
    const badgeY = y - 11;
    const c = severityColor(issue.severity);
    doc.setFillColor(c.r, c.g, c.b);
    doc.setDrawColor(c.r, c.g, c.b);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 6, 6, 'FD');
    doc.setFontSize(9);
    doc.setTextColor(255);
    doc.text(badgeText, badgeX + badgeW / 2, badgeY + 10, { align: 'center' });
    doc.setTextColor(40);

    y += 12;
    const descLines = doc.splitTextToSize(issue.description, right - left);
    doc.text(descLines, left, y);
    y += descLines.length * 12;

    const recLines = doc.splitTextToSize(issue.recommendation, right - left);
    doc.setTextColor(30);
    doc.text(recLines, left, y);
    doc.setTextColor(40);
    y += recLines.length * 12;

    y += 10;
    doc.setDrawColor(230);
    doc.line(left, y, right, y);
    y += 14;
  }

  // Footers for all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    addFooter(p);
  }

  const filename = jobId ? `dataforge_report_${jobId}.pdf` : 'dataforge_report.pdf';
  doc.save(filename);
}

export const DemoDashboard = ({ report }: { report: any }) => {
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const r: any = mapReportToDemoFormat(report);

  const pdfEnabled = useMemo(() => !!report, [report]);

  if (!r) return null;

  const issues = Array.isArray(r.issues) ? r.issues : [];
  const critCount = issues.filter((i: any) => i.severity === 'CRITICAL').length;
  const warnCount = issues.filter((i: any) => i.severity === 'WARNING').length;
  const infoCount = issues.filter((i: any) => i.severity === 'INFO').length;

  const noiseData = {
    outliers: Array.isArray(r.noise_report?.outlier_details) ? r.noise_report.outlier_details.length : 0,
    typeMismatch: Object.keys(r.noise_report?.formatting_errors || {}).length,
    valueNoise: r.noise_report?.total_missing_cells || 0,
    structural: Array.isArray(r.noise_report?.constant_columns) ? r.noise_report.constant_columns.length : 0,
  };

  const imbalanceRatio = Number(r.imbalance_report?.imbalance_ratio || 1);
  const imbalanceSev = imbalanceRatio >= 10 ? 'EXTREME' : imbalanceRatio >= 3 ? 'MODERATE' : imbalanceRatio >= 1.5 ? 'MILD' : 'BALANCED';

  return (
    <div style={{ minHeight: '100vh', background: '#04040a', borderRadius: 16 }}>
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '20px 24px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: '#f0f0f8', margin: 0 }}>
          Advanced Analytics Dashboard
        </h2>
        <p style={{ color: '#7a7a9a', marginTop: 6 }}>Merged demo-style analytics view on top of your live analysis report.</p>

        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            onClick={() => downloadPdfReport(report)}
            disabled={!pdfEnabled}
            style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: 11,
              color: '#f0f0f8',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer',
              opacity: pdfEnabled ? 1 : 0.6,
            }}
          >
            Download PDF report
          </button>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                fontFamily: 'Space Mono, monospace',
                fontSize: 11,
                color: activeTab === tab ? '#f0f0f8' : '#7a7a9a',
                background: activeTab === tab ? 'rgba(255,107,43,0.15)' : 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                padding: '8px 12px',
                cursor: 'pointer',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 20 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'Overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
                <Card>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <ScoreRing value={Number(r.overall_quality_score || 0)} size={150} stroke={10} label="" />
                  </div>
                  <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Stat label="Rows" value={Number(r.dataset_info?.rows || 0).toLocaleString()} />
                    <Stat label="Columns" value={Number(r.dataset_info?.columns || 0)} />
                    <Stat label="Critical" value={critCount} />
                    <Stat label="Warnings" value={warnCount + infoCount} />
                  </div>
                </Card>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Card>
                    <AIInsightCard text={r.executive_summary || 'No summary available.'} title="AI Executive Summary" />
                  </Card>
                  <Card>
                    <h3 style={{ color: '#f0f0f8', marginTop: 0 }}>Top Issues</h3>
                    {issues.length === 0 ? (
                      <p style={{ color: '#7a7a9a' }}>No issues detected.</p>
                    ) : (
                      issues.slice(0, 5).map((i: any) => (
                        <IssueCard
                          key={i.id}
                          title={`${String(i.category || 'issue').toUpperCase()} - ${i.column || 'dataset'}`}
                          severity={i.severity}
                          description={i.description}
                          recommendation={i.recommendation}
                        />
                      ))
                    )}
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'Bias' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Card>
                  <h3 style={{ color: '#f0f0f8', marginTop: 0 }}>Fairness Radar</h3>
                  <BiasRadar biasDetails={r.bias_report?.details || []} fairnessMetrics={r.bias_report?.fairness_metrics || {}} />
                </Card>
                <Card>
                  <h3 style={{ color: '#f0f0f8', marginTop: 0 }}>Correlation View</h3>
                  <CorrelationHeatmap />
                </Card>
              </div>
            )}

            {activeTab === 'Noise' && (
              <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
                <Card>
                  <h3 style={{ color: '#f0f0f8', marginTop: 0 }}>Noise Breakdown</h3>
                  <NoiseDonut data={noiseData} />
                </Card>
                <Card>
                  <h3 style={{ color: '#f0f0f8', marginTop: 0 }}>Outlier Distribution</h3>
                  <OutlierBoxPlot outlierDetails={r.noise_report?.outlier_details || []} />
                </Card>
              </div>
            )}

            {activeTab === 'Duplicates' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Card>
                  <h3 style={{ color: '#f0f0f8', marginTop: 0 }}>Duplicate Graph</h3>
                  <DuplicateGraph />
                </Card>
                <Card>
                  <h3 style={{ color: '#f0f0f8', marginTop: 0 }}>Duplicate Stats</h3>
                  <Stat label="Exact duplicate rows" value={Number(r.duplicate_report?.exact_duplicate_rows || 0)} />
                </Card>
              </div>
            )}

            {activeTab === 'Imbalance' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
                <Card>
                  <h3 style={{ color: '#f0f0f8', marginTop: 0 }}>Class Distribution</h3>
                  <ImbalanceBar
                    classDistribution={r.imbalance_report?.class_distribution || []}
                    imbalanceRatio={Number(r.imbalance_report?.imbalance_ratio || 1)}
                    targetColumn={r.imbalance_report?.target_column || 'target'}
                  />
                </Card>
                <Card>
                  <h3 style={{ color: '#f0f0f8', marginTop: 0 }}>Severity</h3>
                  <SeverityBadge level={imbalanceSev} />
                </Card>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
