"""
statistical_utils.py — shared statistical helpers used across service modules.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from scipy import stats


# ─── Outlier detection ────────────────────────────────────────────────────────

def detect_outliers_iqr(series: pd.Series) -> Tuple[pd.Series, float, float]:
    """
    Identify outliers using the interquartile range (IQR) method.

    Returns
    -------
    mask : pd.Series[bool]   True where the value is an outlier.
    lower : float            Lower fence  (Q1 − 1.5·IQR)
    upper : float            Upper fence  (Q3 + 1.5·IQR)
    """
    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    iqr = q3 - q1
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    mask = (series < lower) | (series > upper)
    return mask, lower, upper


def detect_outliers_zscore(series: pd.Series, threshold: float = 3.0) -> pd.Series:
    """
    Identify outliers using Z-score (mean ± threshold·std).

    Returns a boolean mask.
    """
    z = np.abs(stats.zscore(series.dropna()))
    mask = pd.Series(False, index=series.index)
    mask.iloc[series.dropna().index] = z > threshold
    return mask


# ─── Distribution helpers ─────────────────────────────────────────────────────

def value_distribution(series: pd.Series) -> Dict[str, float]:
    """Return normalised value counts as a dict {value: fraction}."""
    counts = series.value_counts(normalize=True, dropna=True)
    return counts.to_dict()


def dominant_value_fraction(series: pd.Series) -> Tuple[Optional[str], float]:
    """
    Return the most frequent value and its fraction of non-null rows.

    Returns (None, 0.0) if the series is entirely null.
    """
    if series.dropna().empty:
        return None, 0.0
    vc = series.value_counts(normalize=True, dropna=True)
    top_val = str(vc.index[0])
    top_frac = float(vc.iloc[0])
    return top_val, top_frac


# ─── Fairness metrics ─────────────────────────────────────────────────────────

def disparate_impact_ratio(
    df: pd.DataFrame,
    protected_col: str,
    target_col: str,
    positive_label,
    privileged_values: List,
) -> Optional[float]:
    """
    Disparate Impact Ratio = P(Y=1 | unprivileged) / P(Y=1 | privileged).

    A ratio < 0.8 or > 1.25 indicates potential disparate impact (4/5ths rule).
    Returns None if either subgroup is empty or the target column is missing.
    """
    if target_col not in df.columns or protected_col not in df.columns:
        return None

    privileged_mask = df[protected_col].isin(privileged_values)
    p_priv = (df.loc[privileged_mask, target_col] == positive_label).mean()
    p_unpriv = (df.loc[~privileged_mask, target_col] == positive_label).mean()

    if p_priv == 0:
        return None
    return round(p_unpriv / p_priv, 4)


def statistical_parity_difference(
    df: pd.DataFrame,
    protected_col: str,
    target_col: str,
    positive_label,
    privileged_values: List,
) -> Optional[float]:
    """
    Statistical Parity Difference = P(Y=1 | unprivileged) − P(Y=1 | privileged).

    Values close to 0 are desirable.
    """
    if target_col not in df.columns or protected_col not in df.columns:
        return None

    privileged_mask = df[protected_col].isin(privileged_values)
    p_priv = (df.loc[privileged_mask, target_col] == positive_label).mean()
    p_unpriv = (df.loc[~privileged_mask, target_col] == positive_label).mean()
    return round(p_unpriv - p_priv, 4)


# ─── Correlation helpers ──────────────────────────────────────────────────────

def cramers_v(x: pd.Series, y: pd.Series) -> float:
    """
    Cramér's V — measures association between two categorical variables.
    Returns a value in [0, 1].
    """
    ct = pd.crosstab(x, y)
    chi2 = stats.chi2_contingency(ct, correction=False)[0]
    n = ct.sum().sum()
    r, k = ct.shape
    denom = n * (min(r, k) - 1)
    if denom == 0:
        return 0.0
    return float(np.sqrt(chi2 / denom))


def point_biserial_or_pearson(num_col: pd.Series, cat_col: pd.Series) -> float:
    """
    Correlation between a numeric column and an encoded categorical column.
    Uses point-biserial (binary cat) or Pearson on label-encoded values.
    """
    encoded = cat_col.astype("category").cat.codes.astype(float)
    combined = pd.concat([num_col, encoded], axis=1).dropna()
    if combined.shape[0] < 2:
        return 0.0
    r, _ = stats.pearsonr(combined.iloc[:, 0], combined.iloc[:, 1])
    return float(abs(r))


# ─── Misc ─────────────────────────────────────────────────────────────────────

def imbalance_ratio(series: pd.Series) -> float:
    """majority_count / minority_count; returns inf if minority count is 0."""
    vc = series.value_counts()
    if len(vc) < 2:
        return 0.0
    return round(vc.iloc[0] / vc.iloc[-1], 2) if vc.iloc[-1] > 0 else float("inf")


def suggest_cap_value(series: pd.Series, percentile: float = 99.0) -> float:
    """Return the given percentile value as a suggested winsorisation cap."""
    return float(np.percentile(series.dropna(), percentile))
