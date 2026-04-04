"""
data_cleaner.py — Core Data Cleaning Service
Implements: Duplicate Removal, Missing Value Imputation, Outlier Detection/Capping, Type Inference
"""
from __future__ import annotations

import re
import logging
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from scipy import stats
from rapidfuzz.distance import Levenshtein

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Result dataclasses
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class DuplicateRemovalResult:
    exact_removed: int
    fuzzy_removed: int
    total_removed: int
    original_rows: int
    cleaned_rows: int
    fuzzy_threshold_used: float
    duplicate_row_indices: List[int]
    fuzzy_pair_indices: List[Tuple[int, int]]


@dataclass
class MissingValueResult:
    strategy_used: Dict[str, str]          # col -> strategy applied
    cells_filled: Dict[str, int]           # col -> n cells filled
    total_cells_filled: int
    fill_values: Dict[str, Any]            # col -> value used


@dataclass
class OutlierResult:
    method: str                            # 'iqr' | 'zscore'
    columns_processed: List[str]
    outliers_detected: Dict[str, int]      # col -> count
    outliers_capped: Dict[str, int]        # col -> count capped
    bounds: Dict[str, Dict[str, float]]    # col -> {lower, upper}
    total_outliers: int
    total_capped: int


@dataclass
class TypeInferenceResult:
    original_dtypes: Dict[str, str]
    inferred_types: Dict[str, str]
    conversions_applied: Dict[str, str]    # col -> "object→int64" etc.
    conversion_failures: Dict[str, str]    # col -> reason


@dataclass
class CleaningReport:
    duplicate_result: Optional[DuplicateRemovalResult]
    missing_value_result: Optional[MissingValueResult]
    outlier_result: Optional[OutlierResult]
    type_inference_result: Optional[TypeInferenceResult]
    original_shape: Tuple[int, int]
    final_shape: Tuple[int, int]
    operations_applied: List[str]


# ──────────────────────────────────────────────────────────────────────────────
# 1. DUPLICATE REMOVAL
# ──────────────────────────────────────────────────────────────────────────────

def remove_duplicates(
    df: pd.DataFrame,
    fuzzy_threshold: float = 0.90,
    enable_fuzzy: bool = True,
) -> Tuple[pd.DataFrame, DuplicateRemovalResult]:
    """
    Remove exact and fuzzy duplicate rows.
    Exact: pandas duplicated()
    Fuzzy: Levenshtein similarity on string representation of each row
    """
    original_rows = len(df)
    exact_duplicate_indices: List[int] = []
    fuzzy_pair_indices: List[Tuple[int, int]] = []

    # ── Step 1: Exact duplicates ──────────────────────────────────────────────
    exact_mask = df.duplicated(keep='first')
    exact_duplicate_indices = df.index[exact_mask].tolist()
    df_clean = df[~exact_mask].copy()
    exact_removed = len(exact_duplicate_indices)
    logger.info("Exact duplicates removed: %d", exact_removed)

    # ── Step 2: Fuzzy duplicates (similarity ≥ threshold) ────────────────────
    fuzzy_removed_count = 0
    fuzzy_pairs: List[Tuple[int, int]] = []

    if enable_fuzzy and len(df_clean) > 1:
        # Build string signatures for each row using string columns only
        str_cols = df_clean.select_dtypes(include=["object", "string"]).columns.tolist()
        if str_cols:
            # Limit to first 1000 rows for performance (fuzzy matching is expensive)
            sample_size = min(1000, len(df_clean))
            sample = df_clean.head(sample_size)
            row_strings = [
                " ".join(str(v) for v in row if pd.notna(v))
                for row in sample[str_cols].values
            ]
            indices = sample.index.tolist()
            to_drop = set()

            for i in range(len(row_strings)):
                if indices[i] in to_drop:
                    continue
                # Reduce window from 20 to 10 for better performance
                for j in range(i + 1, min(i + 10, len(row_strings))):
                    if indices[j] in to_drop:
                        continue
                    if not row_strings[i] or not row_strings[j]:
                        continue
                    sim = Levenshtein.normalized_similarity(row_strings[i], row_strings[j])
                    if sim >= fuzzy_threshold:
                        to_drop.add(indices[j])
                        fuzzy_pairs.append((int(indices[i]), int(indices[j])))

            fuzzy_pair_indices = fuzzy_pairs
            fuzzy_removed_count = len(to_drop)
            if to_drop:
                df_clean = df_clean.drop(index=list(to_drop))
            logger.info("Fuzzy duplicates removed: %d (threshold=%.2f, checked first %d rows)", fuzzy_removed_count, fuzzy_threshold, sample_size)

    result = DuplicateRemovalResult(
        exact_removed=exact_removed,
        fuzzy_removed=fuzzy_removed_count,
        total_removed=exact_removed + fuzzy_removed_count,
        original_rows=original_rows,
        cleaned_rows=len(df_clean),
        fuzzy_threshold_used=fuzzy_threshold,
        duplicate_row_indices=exact_duplicate_indices,
        fuzzy_pair_indices=fuzzy_pair_indices,
    )
    return df_clean.reset_index(drop=True), result


# ──────────────────────────────────────────────────────────────────────────────
# 2. MISSING VALUE IMPUTATION
# ──────────────────────────────────────────────────────────────────────────────

IMPUTATION_STRATEGIES = ("mean", "median", "mode", "forward_fill", "backward_fill", "drop")

def impute_missing_values(
    df: pd.DataFrame,
    strategy: str = "median",
    column_strategies: Optional[Dict[str, str]] = None,
) -> Tuple[pd.DataFrame, MissingValueResult]:
    """
    Impute missing values using selected strategy.
    column_strategies overrides the global strategy for specific columns.
    """
    df_out = df.copy()
    strategy_used: Dict[str, str] = {}
    cells_filled: Dict[str, int] = {}
    fill_values: Dict[str, Any] = {}

    columns_with_missing = [c for c in df_out.columns if df_out[c].isnull().any()]

    # Cache mode calculation to avoid redundant calls
    mode_cache: Dict[str, Any] = {}

    for col in columns_with_missing:
        col_strategy = (column_strategies or {}).get(col, strategy)
        n_missing = int(df_out[col].isnull().sum())
        is_numeric = pd.api.types.is_numeric_dtype(df_out[col])

        try:
            if col_strategy == "drop":
                df_out = df_out.dropna(subset=[col])
                strategy_used[col] = "drop"
                cells_filled[col] = n_missing
                fill_values[col] = None

            elif col_strategy == "mean":
                if is_numeric:
                    val = float(df_out[col].mean())
                    df_out[col] = df_out[col].fillna(val)
                    fill_values[col] = round(val, 4)
                else:
                    # Cache mode for non-numeric columns
                    if col not in mode_cache:
                        mode_vals = df_out[col].mode()
                        mode_cache[col] = mode_vals.iloc[0] if not mode_vals.empty else "Unknown"
                    val = mode_cache[col]
                    df_out[col] = df_out[col].fillna(val)
                    fill_values[col] = val
                    col_strategy = "mode (fallback)"
                strategy_used[col] = col_strategy
                cells_filled[col] = n_missing

            elif col_strategy == "median":
                if is_numeric:
                    val = float(df_out[col].median())
                    df_out[col] = df_out[col].fillna(val)
                    fill_values[col] = round(val, 4)
                else:
                    if col not in mode_cache:
                        mode_vals = df_out[col].mode()
                        mode_cache[col] = mode_vals.iloc[0] if not mode_vals.empty else "Unknown"
                    val = mode_cache[col]
                    df_out[col] = df_out[col].fillna(val)
                    fill_values[col] = val
                    col_strategy = "mode (fallback)"
                strategy_used[col] = col_strategy
                cells_filled[col] = n_missing

            elif col_strategy == "mode":
                if col not in mode_cache:
                    mode_vals = df_out[col].mode()
                    mode_cache[col] = mode_vals.iloc[0] if not mode_vals.empty else (0 if is_numeric else "Unknown")
                val = mode_cache[col]
                df_out[col] = df_out[col].fillna(val)
                strategy_used[col] = "mode"
                cells_filled[col] = n_missing
                fill_values[col] = val

            elif col_strategy == "forward_fill":
                df_out[col] = df_out[col].ffill()
                strategy_used[col] = "forward_fill"
                cells_filled[col] = n_missing
                fill_values[col] = "propagated"

            elif col_strategy == "backward_fill":
                df_out[col] = df_out[col].bfill()
                strategy_used[col] = "backward_fill"
                cells_filled[col] = n_missing
                fill_values[col] = "propagated"

        except Exception as exc:
            logger.warning("Imputation failed for column '%s': %s", col, exc)
            strategy_used[col] = f"failed ({exc})"
            cells_filled[col] = 0
            fill_values[col] = None

    total_filled = sum(v for v in cells_filled.values() if isinstance(v, int))

    return df_out.reset_index(drop=True), MissingValueResult(
        strategy_used=strategy_used,
        cells_filled=cells_filled,
        total_cells_filled=total_filled,
        fill_values={k: str(v) if v is not None else None for k, v in fill_values.items()},
    )


# ──────────────────────────────────────────────────────────────────────────────
# 3. OUTLIER DETECTION & CAPPING
# ──────────────────────────────────────────────────────────────────────────────

def detect_and_cap_outliers(
    df: pd.DataFrame,
    method: str = "iqr",
    cap: bool = True,
    iqr_multiplier: float = 1.5,
    zscore_threshold: float = 3.0,
) -> Tuple[pd.DataFrame, OutlierResult]:
    """
    Detect outliers using IQR or Z-Score and optionally cap them.
    IQR: lower = Q1 - multiplier*IQR,  upper = Q3 + multiplier*IQR
    Z-Score: |z| > threshold
    """
    df_out = df.copy()
    numeric_cols = df_out.select_dtypes(include=np.number).columns.tolist()

    outliers_detected: Dict[str, int] = {}
    outliers_capped: Dict[str, int] = {}
    bounds: Dict[str, Dict[str, float]] = {}

    for col in numeric_cols:
        series = df_out[col].dropna()
        if series.empty or series.nunique() < 2:
            continue

        if method == "iqr":
            q1 = float(series.quantile(0.25))
            q3 = float(series.quantile(0.75))
            iqr = q3 - q1
            lower = q1 - iqr_multiplier * iqr
            upper = q3 + iqr_multiplier * iqr
        else:  # zscore
            mean = float(series.mean())
            std = float(series.std())
            if std == 0:
                continue
            lower = mean - zscore_threshold * std
            upper = mean + zscore_threshold * std

        mask = (df_out[col] < lower) | (df_out[col] > upper)
        n_outliers = int(mask.sum())
        outliers_detected[col] = n_outliers
        bounds[col] = {"lower": round(lower, 4), "upper": round(upper, 4)}

        if cap and n_outliers > 0:
            df_out[col] = df_out[col].clip(lower=lower, upper=upper)
            outliers_capped[col] = n_outliers
        else:
            outliers_capped[col] = 0

    return df_out, OutlierResult(
        method=method,
        columns_processed=numeric_cols,
        outliers_detected=outliers_detected,
        outliers_capped=outliers_capped,
        bounds=bounds,
        total_outliers=sum(outliers_detected.values()),
        total_capped=sum(outliers_capped.values()),
    )


# ──────────────────────────────────────────────────────────────────────────────
# 4. TYPE INFERENCE
# ──────────────────────────────────────────────────────────────────────────────

# Regex patterns for type detection
_RE_INTEGER = re.compile(r"^-?\d+$")
_RE_FLOAT   = re.compile(r"^-?\d+(\.\d+)?([eE][+-]?\d+)?$")
_RE_BOOL    = re.compile(r"^(true|false|yes|no|1|0|t|f|y|n)$", re.I)
_RE_DATE    = re.compile(
    r"^\d{4}[-/]\d{2}[-/]\d{2}"          # YYYY-MM-DD
    r"|^\d{2}[-/]\d{2}[-/]\d{4}"          # DD-MM-YYYY
    r"|^\d{4}\d{2}\d{2}$"                 # YYYYMMDD
)


def _infer_column_type(series: pd.Series) -> str:
    """Return the most likely Python/pandas type label for a column."""
    sample = series.dropna().astype(str).head(100)  # Reduced from 500
    if sample.empty:
        return "unknown"

    n = len(sample)
    bool_hits   = sample.str.match(_RE_BOOL).sum()
    int_hits    = sample.str.match(_RE_INTEGER).sum()
    float_hits  = sample.str.match(_RE_FLOAT).sum()
    date_hits   = sample.str.match(_RE_DATE).sum()

    ratio_bool  = bool_hits / n
    ratio_int   = int_hits / n
    ratio_float = float_hits / n
    ratio_date  = date_hits / n

    if ratio_bool >= 0.90:
        return "boolean"
    if ratio_int >= 0.90:
        return "integer"
    if ratio_float >= 0.90:
        return "float"
    if ratio_date >= 0.85:
        return "datetime"

    # Numeric distribution heuristic
    try:
        numeric_vals = pd.to_numeric(sample, errors="coerce")
        if numeric_vals.notna().mean() >= 0.90:
            if (numeric_vals.dropna() % 1 == 0).all():
                return "integer"
            return "float"
    except Exception:
        pass

    # Cardinality heuristic → categorical vs free text
    n_unique = series.nunique()
    total = len(series.dropna())
    if total > 0 and n_unique / total < 0.10 and n_unique <= 30:
        return "categorical"

    return "string"


def _try_convert(df: pd.DataFrame, col: str, target_type: str) -> Tuple[pd.DataFrame, bool, str]:
    """Attempt to convert a column to target_type. Returns (df, success, reason)."""
    try:
        if target_type == "integer":
            df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")
        elif target_type == "float":
            df[col] = pd.to_numeric(df[col], errors="coerce").astype(float)
        elif target_type == "boolean":
            mapping = {"true": True, "false": False, "yes": True, "no": False,
                       "1": True, "0": False, "t": True, "f": False, "y": True, "n": False}
            df[col] = df[col].astype(str).str.lower().map(mapping)
        elif target_type == "datetime":
            df[col] = pd.to_datetime(df[col], errors="coerce", infer_datetime_format=True)
        elif target_type == "categorical":
            df[col] = df[col].astype("category")
        return df, True, ""
    except Exception as exc:
        return df, False, str(exc)


def infer_and_convert_types(
    df: pd.DataFrame,
    apply_conversions: bool = True,
) -> Tuple[pd.DataFrame, TypeInferenceResult]:
    """
    Infer column types using regex + statistical analysis and optionally apply conversions.
    """
    df_out = df.copy()
    original_dtypes = {c: str(dt) for c, dt in df.dtypes.items()}
    inferred_types: Dict[str, str] = {}
    conversions_applied: Dict[str, str] = {}
    conversion_failures: Dict[str, str] = {}

    for col in df_out.columns:
        current_dtype = str(df_out[col].dtype)

        # Only attempt inference on object/string columns (already typed columns skip)
        if current_dtype not in ("object", "string", "O"):
            inferred_types[col] = current_dtype
            continue

        inferred = _infer_column_type(df_out[col])
        inferred_types[col] = inferred

        if not apply_conversions:
            continue

        # Skip if inferred type is string/unknown (nothing to convert)
        if inferred in ("string", "unknown"):
            continue

        df_out, success, reason = _try_convert(df_out, col, inferred)
        new_dtype = str(df_out[col].dtype)

        if success and new_dtype != current_dtype:
            conversions_applied[col] = f"{current_dtype} → {new_dtype}"
        elif not success:
            conversion_failures[col] = reason

    return df_out, TypeInferenceResult(
        original_dtypes=original_dtypes,
        inferred_types=inferred_types,
        conversions_applied=conversions_applied,
        conversion_failures=conversion_failures,
    )


# ──────────────────────────────────────────────────────────────────────────────
# 5. ORCHESTRATOR
# ──────────────────────────────────────────────────────────────────────────────

def run_cleaning_pipeline(
    df: pd.DataFrame,
    *,
    # Duplicate config
    remove_exact_duplicates: bool = True,
    remove_fuzzy_duplicates: bool = True,
    fuzzy_threshold: float = 0.90,
    # Missing value config
    impute_missing: bool = True,
    imputation_strategy: str = "median",
    column_strategies: Optional[Dict[str, str]] = None,
    # Outlier config
    handle_outliers: bool = True,
    outlier_method: str = "iqr",
    cap_outliers: bool = True,
    # Type inference config
    infer_types: bool = True,
    apply_type_conversions: bool = True,
) -> Tuple[pd.DataFrame, CleaningReport]:
    """Run the full cleaning pipeline in order: types → duplicates → missing → outliers."""
    original_shape = df.shape
    operations_applied: List[str] = []

    dup_result: Optional[DuplicateRemovalResult] = None
    missing_result: Optional[MissingValueResult] = None
    outlier_result: Optional[OutlierResult] = None
    type_result: Optional[TypeInferenceResult] = None

    df_work = df.copy()

    # Step 1: Type inference first (so numeric operations work correctly)
    if infer_types:
        logger.info("Step 1/4: Type inference")
        df_work, type_result = infer_and_convert_types(df_work, apply_conversions=apply_type_conversions)
        if type_result.conversions_applied:
            operations_applied.append(f"type_inference ({len(type_result.conversions_applied)} cols converted)")

    # Step 2: Duplicate removal (skip fuzzy on very large datasets for performance)
    if remove_exact_duplicates:
        logger.info("Step 2/4: Duplicate removal")
        # Disable fuzzy duplicates for datasets larger than 100k rows to avoid timeout
        use_fuzzy = remove_fuzzy_duplicates and len(df_work) < 100000
        df_work, dup_result = remove_duplicates(
            df_work,
            fuzzy_threshold=fuzzy_threshold,
            enable_fuzzy=use_fuzzy,
        )
        if dup_result.total_removed > 0:
            operations_applied.append(
                f"duplicate_removal ({dup_result.exact_removed} exact, {dup_result.fuzzy_removed} fuzzy)"
            )

    # Step 3: Missing value imputation
    if impute_missing:
        logger.info("Step 3/4: Missing value imputation (%s)", imputation_strategy)
        df_work, missing_result = impute_missing_values(
            df_work,
            strategy=imputation_strategy,
            column_strategies=column_strategies,
        )
        if missing_result.total_cells_filled > 0:
            operations_applied.append(
                f"imputation ({missing_result.total_cells_filled} cells, strategy={imputation_strategy})"
            )

    # Step 4: Outlier handling
    if handle_outliers:
        logger.info("Step 4/4: Outlier detection (%s)", outlier_method)
        df_work, outlier_result = detect_and_cap_outliers(
            df_work,
            method=outlier_method,
            cap=cap_outliers,
        )
        if outlier_result.total_outliers > 0:
            operations_applied.append(
                f"outlier_handling ({outlier_result.total_outliers} detected, {outlier_result.total_capped} capped)"
            )

    report = CleaningReport(
        duplicate_result=dup_result,
        missing_value_result=missing_result,
        outlier_result=outlier_result,
        type_inference_result=type_result,
        original_shape=original_shape,
        final_shape=df_work.shape,
        operations_applied=operations_applied,
    )
    return df_work, report
