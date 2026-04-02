"""
dataforge_analytics — Member 2's analytics package.
ADDED: analyze_dataset() wrapper that Member 1's backend calls.
       Exports the function with the exact signature specified in the brief.
"""
from .noise_detector import detect_outliers, detect_datatype_noise, detect_value_noise, detect_structural_noise
from .imbalance_analyzer import analyze_imbalance
from .duplicate_detector import detect_exact_duplicates, detect_near_duplicates, detect_semantic_duplicates, detect_cross_column_redundancy
from .quality_scorer import calculate_quality_score
from .profiler import profile_dataset

import pandas as pd
from typing import Any, Dict, Optional


def analyze_dataset(df: pd.DataFrame, config: Dict[str, Any]) -> Dict[str, Any]:
    """
    WRITTEN BY AGENT — wrapper required by backend integration contract.

    Parameters
    ----------
    df     : pandas DataFrame to analyse
    config : dict with optional keys:
               target_column      (str | None)
               sensitive_columns  (list[str])
               bias_threshold     (float)

    Returns a dict that partially maps to the QualityReport JSON shape.
    Member 1's report_generator.py uses this as supplementary data.
    """
    target_col: Optional[str] = config.get("target_column")

    # ── Profile ───────────────────────────────────────────────────────────────
    profile = profile_dataset(df)

    # ── Quality score ─────────────────────────────────────────────────────────
    quality = calculate_quality_score(df)

    # ── Noise ─────────────────────────────────────────────────────────────────
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    outlier_reports = [detect_outliers(df, col) for col in numeric_cols]
    datatype_noise = detect_datatype_noise(df)
    value_noise = detect_value_noise(df)
    structural_noise = detect_structural_noise(df)

    # ── Duplicates ────────────────────────────────────────────────────────────
    exact_dups = detect_exact_duplicates(df)

    # Near-duplicate detection can be slow on large frames — cap sample
    sample_df = df.head(2000) if len(df) > 2000 else df
    near_dups = detect_near_duplicates(sample_df)
    cross_col = detect_cross_column_redundancy(df)

    # ── Imbalance ─────────────────────────────────────────────────────────────
    imbalance_result = None
    if target_col and target_col in df.columns:
        try:
            imbalance_result = analyze_imbalance(df, target_col)
        except Exception:
            imbalance_result = None

    return {
        "profile": profile.model_dump(),
        "quality_score": quality.model_dump(),
        "outliers": [r.model_dump() for r in outlier_reports],
        "datatype_noise": datatype_noise.model_dump(),
        "value_noise": value_noise.model_dump(),
        "structural_noise": structural_noise.model_dump(),
        "exact_duplicates": exact_dups.model_dump(),
        "near_duplicates": near_dups.model_dump(),
        "cross_column_redundancy": cross_col.model_dump(),
        "imbalance": imbalance_result.model_dump() if imbalance_result else None,
    }


__all__ = [
    "analyze_dataset",
    "detect_outliers", "detect_datatype_noise", "detect_value_noise", "detect_structural_noise",
    "analyze_imbalance",
    "detect_exact_duplicates", "detect_near_duplicates", "detect_semantic_duplicates", "detect_cross_column_redundancy",
    "calculate_quality_score",
    "profile_dataset",
]
