export const mapReportToDemoFormat = (report: any) => {
  const findDim = (name: string) => report.result.dimensions.find((d: any) => d.name === name);
  
  const bias = findDim('bias') || { metrics: {} };
  const noise = findDim('noise') || { metrics: {} };
  const duplication = findDim('duplication') || { metrics: {} };
  const imbalance = findDim('imbalance') || { metrics: {} };

  return {
    job_id: report.job_id,
    status: 'complete',
    dataset_info: {
      rows: report.result.dataset_summary.rows,
      columns: report.result.dataset_summary.columns,
      missing_summary: noise.metrics?.missing_ratio_by_column || {}
    },
    overall_quality_score: report.result.quality_score,
    executive_summary: report.ai_report.executive_summary,
    issues: [
      ...(bias.alerts || []),
      ...(noise.alerts || []),
      ...(duplication.alerts || []),
      ...(imbalance.alerts || [])
    ].map((a: any, i: number) => ({
      id: `issue_${i}`,
      category: a.dimension,
      severity: a.severity.toUpperCase(),
      description: a.message,
      recommendation: report.ai_report.top_actions?.[i]?.action || 'Review and remediate.'
    })),
    dimension_scores: {
      completeness: report.result.score_breakdown?.completeness || 0,
      uniqueness: report.result.score_breakdown?.uniqueness || 0,
      consistency: report.result.score_breakdown?.consistency || 0,
      validity: report.result.score_breakdown?.validity || 0,
      balance: report.result.score_breakdown?.balance || 0
    },
    bias_report: {
      overall_bias_score: bias.score,
      details: [
        {
          column: 'Demographics',
          bias_type: 'demographic',
          disparate_impact_ratio: bias.metrics?.group_disparity?.DIR || 0.8,
          statistical_parity_diff: bias.metrics?.group_disparity?.SPD || -0.05
        }
      ],
      fairness_metrics: {
        Demographics: {
          DIR: bias.metrics?.group_disparity?.DIR || 0.82,
          SPD: bias.metrics?.group_disparity?.SPD || -0.05
        }
      }
    },
    noise_report: {
      missing_value_columns: Object.keys(noise.metrics?.missing_ratio_by_column || {}).filter(k => noise.metrics.missing_ratio_by_column[k] > 0),
      total_missing_cells: noise.metrics?.avg_missing * report.result.dataset_summary.rows * report.result.dataset_summary.columns || 0,
      missing_fraction: noise.metrics?.avg_missing || 0,
      outlier_details: Object.entries(noise.metrics?.outlier_rate_by_numeric_column || {}).map(([col, val]) => ({
        column: col,
        outlier_fraction: val,
        outlier_count: (val as number) * report.result.dataset_summary.rows
      })),
      formatting_errors: {},
      constant_columns: [],
      high_cardinality_columns: []
    },
    duplicate_report: {
      exact_duplicate_rows: duplication.metrics?.exact_duplicate_ratio ? duplication.metrics.exact_duplicate_ratio * report.result.dataset_summary.rows : 0,
      exact_duplicate_fraction: duplication.metrics?.exact_duplicate_ratio || 0,
    },
    imbalance_report: {
      target_column: report.result.dataset_summary.target_column || 'target',
      class_distribution: Object.entries(imbalance.metrics?.target_distribution || {}).map(([k, v]: any) => ({
        label: k, count: v * report.result.dataset_summary.rows, fraction: v
      })),
      imbalance_ratio: imbalance.metrics?.imbalance_ratio || 1,
      is_imbalanced: imbalance.metrics?.imbalance_ratio > 3
    }
  };
};
