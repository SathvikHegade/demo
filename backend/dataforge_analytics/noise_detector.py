"""
noise_detector.py — Member 2's noise detection.
FIXED: replaced fuzzywuzzy with rapidfuzz (no C compiler needed, faster).
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import re
from typing import List, Dict, Any
from rapidfuzz import fuzz, process  # FIXED: was fuzzywuzzy
from .models import OutlierReport, DataTypeNoiseReport, ValueNoiseReport, StructuralNoiseReport
from .constants import IQR_MULTIPLIER, Z_SCORE_THRESHOLD, SENTINEL_VALUES, FUZZY_MATCH_THRESHOLD, LOW_VARIANCE_THRESHOLD


def detect_outliers(df: pd.DataFrame, column: str, method: str = "iqr") -> OutlierReport:
    """Detect outliers in a numeric column."""
    if column not in df.columns or not pd.api.types.is_numeric_dtype(df[column]):
        return OutlierReport(column_name=column, outlier_count=0, outlier_indices=[],
                             outlier_percentage=0.0, method_used=method, bounds={})

    series = df[column].dropna()
    if len(series) == 0:
        return OutlierReport(column_name=column, outlier_count=0, outlier_indices=[],
                             outlier_percentage=0.0, method_used=method, bounds={})

    outlier_idx = []
    bounds = {}

    if method == "iqr":
        Q1 = series.quantile(0.25)
        Q3 = series.quantile(0.75)
        IQR = Q3 - Q1
        lower, upper = Q1 - IQR_MULTIPLIER * IQR, Q3 + IQR_MULTIPLIER * IQR
        outlier_idx = series[(series < lower) | (series > upper)].index.tolist()
        bounds = {"lower": float(lower), "upper": float(upper)}
    elif method == "zscore":
        mean, std = series.mean(), series.std()
        if std > 0:
            z_scores = ((series - mean) / std).abs()
            outlier_idx = series[z_scores > Z_SCORE_THRESHOLD].index.tolist()
        bounds = {"mean": float(mean), "std": float(std)}
    elif method == "modified_zscore":
        median = series.median()
        mad = (series - median).abs().median()
        if mad > 0:
            z_scores = 0.6745 * (series - median) / mad
            outlier_idx = series[z_scores.abs() > Z_SCORE_THRESHOLD].index.tolist()
        bounds = {"median": float(median), "mad": float(mad)}
    elif method == "isolation_forest":
        iso = IsolationForest(contamination=0.05, random_state=42)
        preds = iso.fit_predict(series.values.reshape(-1, 1))
        outlier_idx = series[preds == -1].index.tolist()

    return OutlierReport(
        column_name=column,
        outlier_count=len(outlier_idx),
        outlier_indices=[int(i) for i in outlier_idx],
        outlier_percentage=len(outlier_idx) / len(df) if len(df) > 0 else 0.0,
        method_used=method,
        bounds=bounds
    )


def detect_datatype_noise(df: pd.DataFrame) -> DataTypeNoiseReport:
    """Detect type inconsistencies like numeric stored as strings."""
    affected = []
    format_issues = {}
    type_mismatch = 0

    for col in df.columns:
        if pd.api.types.is_object_dtype(df[col]) or pd.api.types.is_string_dtype(df[col]):
            s_clean = df[col].dropna().astype(str)
            numeric_like = s_clean.str.contains(
                r'^[\$\€\£]?\s*\-?[\d,]+(?:\.\d+)?\s*[kKmMbB]?\s*$', regex=True
            ).sum()

            if numeric_like > 0 and numeric_like < len(s_clean):
                type_mismatch += numeric_like
                affected.append(col)
                format_issues[col] = ["Mixed numeric and string types"]
            elif numeric_like == len(s_clean) and len(s_clean) > 0:
                type_mismatch += len(s_clean)
                affected.append(col)
                format_issues[col] = ["Numeric values stored as strings"]

    return DataTypeNoiseReport(
        affected_columns=list(set(affected)),
        type_mismatch_count=type_mismatch,
        format_inconsistencies=format_issues
    )


def detect_value_noise(df: pd.DataFrame) -> ValueNoiseReport:
    """Detect whitespace, inconsistent casing, typos, and sentinels."""
    noisy_count = 0
    affected = []
    grouped_categories = {}

    for col in df.columns:
        if pd.api.types.is_object_dtype(df[col]) or pd.api.types.is_string_dtype(df[col]):
            s = df[col].dropna().astype(str)
            if s.empty:
                continue

            sentinels = s[s.str.lower().isin(SENTINEL_VALUES)]
            noisy_count += len(sentinels)

            stripped = s.str.strip()
            whitespace_issues = s[s != stripped]
            noisy_count += len(whitespace_issues)

            lower_mapped = stripped.str.lower()
            uniques = lower_mapped.unique()
            col_groups = {}
            # FIXED: use rapidfuzz.fuzz.ratio (returns 0-100, same interface)
            if 0 < len(uniques) < min(100, len(s) / 2):
                for u in uniques:
                    matches = []
                    for target in uniques:
                        if u != target and fuzz.ratio(u, target) >= FUZZY_MATCH_THRESHOLD:
                            matches.append(target)
                    if matches:
                        col_groups[u] = matches

            if len(sentinels) > 0 or len(whitespace_issues) > 0 or col_groups:
                if col not in affected:
                    affected.append(col)
                if col_groups:
                    merged = {k: ', '.join(v) for k, v in col_groups.items()}
                    grouped_categories[col] = merged

    return ValueNoiseReport(
        noisy_value_count=noisy_count,
        affected_columns=affected,
        grouped_categories=grouped_categories
    )


def detect_structural_noise(df: pd.DataFrame) -> StructuralNoiseReport:
    """Detect empty rows, constant columns, and low variance."""
    empty_rows = df[df.isna().all(axis=1)].index.tolist()
    constant_cols = [c for c in df.columns if df[c].nunique(dropna=True) <= 1]
    low_var_cols = []

    for col in df.columns:
        if col not in constant_cols:
            val_counts = df[col].value_counts(normalize=True)
            if not val_counts.empty and val_counts.iloc[0] > LOW_VARIANCE_THRESHOLD:
                low_var_cols.append(col)

    return StructuralNoiseReport(
        empty_rows=[int(i) for i in empty_rows],
        low_variance_columns=low_var_cols,
        constant_columns=constant_cols
    )
