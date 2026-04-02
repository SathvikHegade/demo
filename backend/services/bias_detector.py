"""
bias_detector.py — demographic, label, and proxy bias detection with fairness metrics.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from models.response_models import BiasReport, ColumnBiasDetail
from utils.statistical_utils import (
    cramers_v,
    disparate_impact_ratio,
    dominant_value_fraction,
    point_biserial_or_pearson,
    statistical_parity_difference,
)

# Columns whose names suggest they contain sensitive demographic data
SENSITIVE_PATTERNS = re.compile(
    r"\b(gender|sex|race|ethnicity|nationality|religion|age|"
    r"disability|marital.?status|location|zip|postal|income|salary)\b",
    re.IGNORECASE,
)

# Typical "privileged" values used when computing fairness metrics
PRIVILEGED_DEFAULTS: Dict[str, List[str]] = {
    "gender": ["male", "m", "man"],
    "sex": ["male", "m"],
    "race": ["white", "caucasian"],
    "ethnicity": ["white", "caucasian"],
}


def _auto_detect_sensitive(df: pd.DataFrame) -> List[str]:
    """Return column names that match SENSITIVE_PATTERNS."""
    return [c for c in df.columns if SENSITIVE_PATTERNS.search(c)]


def _bias_score(dominant_fraction: float, threshold: float) -> float:
    """
    Map the dominant-fraction excess over the threshold to a 0–100 bias score.

    At the threshold the score is 0; at 1.0 (fully dominated) the score is 100.
    """
    if dominant_fraction <= threshold:
        return 0.0
    excess = (dominant_fraction - threshold) / (1.0 - threshold)
    return round(min(excess * 100, 100.0), 2)


def _proxy_correlations(
    df: pd.DataFrame,
    sensitive_cols: List[str],
    numeric_cols: List[str],
    categorical_cols: List[str],
) -> Dict[Tuple[str, str], float]:
    """
    Compute pairwise correlation between sensitive columns and all other columns.

    Returns a dict mapping (sensitive_col, other_col) → correlation_score.
    """
    correlations: Dict[Tuple[str, str], float] = {}
    for sc in sensitive_cols:
        for nc in numeric_cols:
            if nc == sc:
                continue
            try:
                corr = point_biserial_or_pearson(df[nc], df[sc])
                correlations[(sc, nc)] = corr
            except Exception:
                pass
        for cc in categorical_cols:
            if cc == sc:
                continue
            try:
                corr = cramers_v(df[sc].astype(str), df[cc].astype(str))
                correlations[(sc, cc)] = corr
            except Exception:
                pass
    return correlations


async def run_bias_detection(
    df: pd.DataFrame,
    sensitive_columns: List[str],
    target_column: Optional[str],
    bias_threshold: float,
) -> BiasReport:
    """
    Run full bias detection pipeline and return a structured BiasReport.

    Parameters
    ----------
    df : pd.DataFrame
        The dataset to analyse.
    sensitive_columns : list[str]
        Caller-specified sensitive columns; auto-detected if empty.
    target_column : str | None
        Label column for fairness metric computation.
    bias_threshold : float
        Fraction above which a dominant value triggers a bias flag.
    """
    if not sensitive_columns:
        sensitive_columns = _auto_detect_sensitive(df)

    # Validate columns exist in dataframe
    sensitive_columns = [c for c in sensitive_columns if c in df.columns]

    numeric_cols = df.select_dtypes(include=np.number).columns.tolist()
    categorical_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()

    proxy_corrs = _proxy_correlations(df, sensitive_columns, numeric_cols, categorical_cols)
    PROXY_THRESHOLD = 0.65

    details: List[ColumnBiasDetail] = []
    affected_columns: List[str] = []
    fairness_metrics: Dict[str, Any] = {}

    # ── Determine positive label for fairness metrics ─────────────────────────
    positive_label = None
    if target_column and target_column in df.columns:
        vc = df[target_column].value_counts()
        positive_label = vc.index[0]  # treat most common as positive (convention)

    for col in sensitive_columns:
        dominant_val, dominant_frac = dominant_value_fraction(df[col])
        score = _bias_score(dominant_frac, bias_threshold)
        is_biased = score > 0

        if is_biased:
            affected_columns.append(col)

        # Fairness metrics
        dir_val = None
        spd_val = None
        if target_column and positive_label is not None:
            col_lower = col.lower()
            privileged = PRIVILEGED_DEFAULTS.get(col_lower, [dominant_val] if dominant_val else [])
            dir_val = disparate_impact_ratio(df, col, target_column, positive_label, privileged)
            spd_val = statistical_parity_difference(df, col, target_column, positive_label, privileged)
            fairness_metrics[col] = {"DIR": dir_val, "SPD": spd_val}

        # Proxy detection — check if any non-sensitive column has high correlation
        proxy_corr: Optional[float] = None
        is_proxy = False
        for (sc, other), corr_val in proxy_corrs.items():
            if other == col and corr_val >= PROXY_THRESHOLD:
                proxy_corr = corr_val
                is_proxy = True
                break

        details.append(
            ColumnBiasDetail(
                column=col,
                bias_type="demographic",
                dominant_value=dominant_val,
                dominant_fraction=round(dominant_frac, 4),
                disparate_impact_ratio=dir_val,
                statistical_parity_diff=spd_val,
                proxy_correlation=proxy_corr,
                is_proxy=is_proxy,
                bias_score=score,
            )
        )

    # Also flag columns that are proxies FOR sensitive attributes
    for (sc, other), corr_val in proxy_corrs.items():
        if corr_val >= PROXY_THRESHOLD and other not in [d.column for d in details]:
            dominant_val, dominant_frac = dominant_value_fraction(df[other])
            details.append(
                ColumnBiasDetail(
                    column=other,
                    bias_type="proxy",
                    dominant_value=dominant_val,
                    dominant_fraction=round(dominant_frac, 4),
                    proxy_correlation=round(corr_val, 4),
                    is_proxy=True,
                    bias_score=round(min(corr_val * 100, 100.0), 2),
                )
            )
            if other not in affected_columns:
                affected_columns.append(other)

    overall = round(
        float(np.mean([d.bias_score for d in details])) if details else 0.0, 2
    )

    return BiasReport(
        overall_bias_score=overall,
        affected_columns=affected_columns,
        details=details,
        fairness_metrics=fairness_metrics,
    )
