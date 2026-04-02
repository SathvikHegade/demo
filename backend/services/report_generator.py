"""
report_generator.py — Assembles statistical sub-reports and the full QualityReport.
FIXED: assemble_report now maps to QualityReport fields including grade + dimension_scores.
       status field set to "complete" (matching frontend contract).
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder

from models.request_models import AnalysisConfig
from models.response_models import (
    BiasReport,
    ClassDetail,
    DatasetInfo,
    DuplicateReport,
    ImbalanceReport,
    Issue,
    NLPReport,
    NoiseReport,
    OutlierDetail,
    QualityReport,
)
from utils.statistical_utils import (
    detect_outliers_iqr,
    detect_outliers_zscore,
    imbalance_ratio,
    suggest_cap_value,
)


def _build_noise_report(df: pd.DataFrame, config: AnalysisConfig) -> NoiseReport:
    total_cells = df.size
    missing_per_col = df.isnull().sum()
    missing_fraction = float(missing_per_col.sum() / max(total_cells, 1))
    missing_value_columns = missing_per_col[missing_per_col > 0].index.tolist()

    numeric_cols = df.select_dtypes(include=np.number).columns.tolist()

    outlier_details: List[OutlierDetail] = []
    for col in numeric_cols:
        series = df[col].dropna()
        if series.empty:
            continue
        if config.outlier_method == "iqr":
            mask, lower, upper = detect_outliers_iqr(series)
            n_out = int(mask.sum())
            cap_val = suggest_cap_value(series) if n_out > 0 else None
            outlier_details.append(
                OutlierDetail(
                    column=col,
                    method="iqr",
                    outlier_count=n_out,
                    outlier_fraction=round(n_out / max(len(series), 1), 4),
                    lower_bound=round(lower, 4),
                    upper_bound=round(upper, 4),
                    suggested_cap_value=round(cap_val, 4) if cap_val is not None else None,
                )
            )
        else:
            mask = detect_outliers_zscore(series)
            n_out = int(mask.sum())
            cap_val = suggest_cap_value(series) if n_out > 0 else None
            outlier_details.append(
                OutlierDetail(
                    column=col,
                    method="zscore",
                    outlier_count=n_out,
                    outlier_fraction=round(n_out / max(len(series), 1), 4),
                    lower_bound=None,
                    upper_bound=None,
                    suggested_cap_value=round(cap_val, 4) if cap_val is not None else None,
                )
            )

    constant_cols = [c for c in df.columns if df[c].nunique(dropna=True) <= 1]
    obj_cols = df.select_dtypes(include="object").columns
    high_card = [
        c for c in obj_cols
        if df[c].nunique() / max(len(df), 1) > 0.5 and df[c].nunique() > 20
    ]

    formatting_errors: dict[str, int] = {}
    for col in df.select_dtypes(include="object").columns:
        sample = df[col].dropna().astype(str).head(500)
        n_numeric = sample.str.match(r"^-?\d+(\.\d+)?$").sum()
        n_total = len(sample)
        if 0 < n_numeric < n_total:
            formatting_errors[col] = int(n_total - n_numeric)

    return NoiseReport(
        missing_value_columns=missing_value_columns,
        total_missing_cells=int(missing_per_col.sum()),
        missing_fraction=round(missing_fraction, 4),
        outlier_details=outlier_details,
        formatting_errors=formatting_errors,
        constant_columns=constant_cols,
        high_cardinality_columns=high_card,
    )


def _build_duplicate_report(df: pd.DataFrame, fuzzy_threshold: float) -> DuplicateReport:
    n = len(df)
    exact_dupes = int(df.duplicated().sum())

    seen: dict[str, str] = {}
    dup_cols: list[str] = []
    for col in df.columns:
        key = str(df[col].tolist())
        if key in seen:
            dup_cols.append(col)
        else:
            seen[key] = col

    near_dup_pairs = 0
    sample_size = min(n, 2000)
    sample_df = df.sample(sample_size, random_state=42).astype(str)
    rows = [set(row) for row in sample_df.values.tolist()]

    for i in range(len(rows)):
        for j in range(i + 1, min(i + 5, len(rows))):
            union = rows[i] | rows[j]
            inter = rows[i] & rows[j]
            jaccard = len(inter) / max(len(union), 1)
            if jaccard >= fuzzy_threshold and rows[i] != rows[j]:
                near_dup_pairs += 1

    scale = (n / sample_size) ** 2 if sample_size < n else 1
    estimated_near_dup = int(near_dup_pairs * scale * 0.5)

    return DuplicateReport(
        exact_duplicate_rows=exact_dupes,
        exact_duplicate_fraction=round(exact_dupes / max(n, 1), 4),
        near_duplicate_pairs=estimated_near_dup,
        near_duplicate_fraction=round(estimated_near_dup / max(n * (n - 1) / 2, 1), 6),
        duplicate_columns=dup_cols,
    )


def _build_imbalance_report(df: pd.DataFrame, target_column: Optional[str]) -> ImbalanceReport:
    if not target_column or target_column not in df.columns:
        return ImbalanceReport(
            target_column=None,
            class_distribution=[],
            imbalance_ratio=0.0,
            is_imbalanced=False,
            recommended_strategy="No target column provided.",
        )

    series = df[target_column].dropna()
    vc = series.value_counts()
    n = len(series)

    dist = [
        ClassDetail(label=str(lbl), count=int(cnt), fraction=round(cnt / n, 4))
        for lbl, cnt in vc.items()
    ]
    ratio = imbalance_ratio(series)
    is_imbalanced = ratio >= 3.0

    if ratio >= 10:
        strategy = "SMOTE oversampling or cost-sensitive learning (class_weight='balanced')"
    elif ratio >= 3:
        strategy = "Random oversampling / SMOTE, or adjust class weights in model"
    else:
        strategy = "Dataset is reasonably balanced — no special strategy required"

    return ImbalanceReport(
        target_column=target_column,
        class_distribution=dist,
        imbalance_ratio=ratio,
        is_imbalanced=is_imbalanced,
        recommended_strategy=strategy,
    )


def _build_dataset_info(df: pd.DataFrame, size_mb: float) -> DatasetInfo:
    missing_summary = {col: round(df[col].isnull().mean(), 4) for col in df.columns}
    return DatasetInfo(
        rows=len(df),
        columns=len(df.columns),
        size_mb=round(size_mb, 3),
        column_names=df.columns.tolist(),
        dtypes={col: str(dtype) for col, dtype in df.dtypes.items()},
        missing_summary=missing_summary,
    )


def _compute_quality_score(
    noise: NoiseReport,
    dup: DuplicateReport,
    bias: BiasReport,
    imbalance: ImbalanceReport,
) -> tuple[float, dict]:
    """Returns (overall_score 0-100, dimension_scores dict)."""
    missing_penalty = min(noise.missing_fraction * 100, 30)
    max_outlier_frac = max((od.outlier_fraction for od in noise.outlier_details), default=0.0)
    outlier_penalty = min(max_outlier_frac * 100, 20)
    dup_penalty = min(dup.exact_duplicate_fraction * 100, 20)
    bias_penalty = min(bias.overall_bias_score / 5, 20)
    imb_ratio = imbalance.imbalance_ratio
    imb_penalty = min((imb_ratio / 10.0) * 10, 10) if imbalance.is_imbalanced else 0.0

    completeness = round(max(0.0, 100.0 - missing_penalty * 3.33), 2)
    uniqueness = round(max(0.0, 100.0 - dup_penalty * 5), 2)
    consistency = round(max(0.0, 100.0 - (len(noise.formatting_errors) * 5)), 2)
    validity = round(max(0.0, 100.0 - outlier_penalty * 5), 2)
    balance = round(max(0.0, 100.0 - imb_penalty * 10), 2)

    total_penalty = missing_penalty + outlier_penalty + dup_penalty + bias_penalty + imb_penalty
    overall = round(max(0.0, 100.0 - total_penalty), 2)

    return overall, {
        "completeness": completeness,
        "uniqueness": uniqueness,
        "consistency": consistency,
        "validity": validity,
        "balance": balance,
    }


def _get_grade(score: float) -> str:
    if score >= 90: return "A"
    if score >= 80: return "B"
    if score >= 70: return "C"
    if score >= 60: return "D"
    return "F"


def build_statistical_summary(
    df: pd.DataFrame,
    bias: BiasReport,
    noise: NoiseReport,
    dup: DuplicateReport,
    imbalance: ImbalanceReport,
    config: AnalysisConfig,
) -> dict:
    numeric_stats = {}
    for col in df.select_dtypes(include=np.number).columns:
        s = df[col].describe()
        numeric_stats[col] = {k: round(float(v), 4) for k, v in s.items()}

    return {
        "dataset_shape": {"rows": len(df), "columns": len(df.columns)},
        "missing_fraction": noise.missing_fraction,
        "missing_columns": noise.missing_value_columns,
        "constant_columns": noise.constant_columns,
        "high_cardinality_columns": noise.high_cardinality_columns,
        "formatting_error_columns": list(noise.formatting_errors.keys()),
        "outliers": [
            {
                "column": od.column,
                "count": od.outlier_count,
                "fraction": od.outlier_fraction,
                "lower_bound": od.lower_bound,
                "upper_bound": od.upper_bound,
                "suggested_cap": od.suggested_cap_value,
            }
            for od in noise.outlier_details
            if od.outlier_count > 0
        ],
        "exact_duplicates": dup.exact_duplicate_rows,
        "exact_dup_fraction": dup.exact_duplicate_fraction,
        "near_duplicate_pairs": dup.near_duplicate_pairs,
        "bias_affected_columns": bias.affected_columns,
        "bias_details": [
            {
                "column": d.column,
                "dominant_value": d.dominant_value,
                "dominant_fraction": d.dominant_fraction,
                "bias_score": d.bias_score,
                "bias_type": d.bias_type,
                "dir": d.disparate_impact_ratio,
                "spd": d.statistical_parity_diff,
                "is_proxy": d.is_proxy,
            }
            for d in bias.details
        ],
        "fairness_metrics": bias.fairness_metrics,
        "imbalance": {
            "target_column": imbalance.target_column,
            "imbalance_ratio": imbalance.imbalance_ratio,
            "is_imbalanced": imbalance.is_imbalanced,
            "distribution": [
                {"label": c.label, "fraction": c.fraction}
                for c in imbalance.class_distribution
            ],
        },
        "numeric_column_stats": numeric_stats,
        "config": {
            "sensitive_columns": config.sensitive_columns,
            "target_column": config.target_column,
            "bias_threshold": config.bias_threshold,
        },
    }


def assemble_report(
    job_id: str,
    df: pd.DataFrame,
    size_mb: float,
    config: AnalysisConfig,
    bias: BiasReport,
    noise: NoiseReport,
    dup: DuplicateReport,
    imbalance: ImbalanceReport,
    nlp: NLPReport,
    ai_issues: List[Issue],
    executive_summary: str,
) -> QualityReport:
    dataset_info = _build_dataset_info(df, size_mb)
    quality_score, dimension_scores = _compute_quality_score(noise, dup, bias, imbalance)
    grade = _get_grade(quality_score)

    return QualityReport(
        job_id=job_id,
        status="complete",          # FIXED: contract requires "complete" not "completed"
        dataset_info=dataset_info,
        overall_quality_score=quality_score,
        grade=grade,
        executive_summary=executive_summary,
        issues=ai_issues,
        dimension_scores=dimension_scores,
        bias_report=bias,
        noise_report=noise,
        duplicate_report=dup,
        imbalance_report=imbalance,
        nlp_report=nlp,
        generated_at=datetime.utcnow(),
    )
