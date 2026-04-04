"""
data_cleaner.py — Core Data Cleaning Service
Fast, production-ready implementation:
  - Exact duplicate removal via pandas
  - Fuzzy duplicate removal via MinHash LSH (O(n) not O(n²))
  - Missing value imputation: mean/median/mode/forward_fill/backward_fill/drop
  - Outlier detection & capping: IQR or Z-Score with custom thresholds
  - Type inference: regex + statistical heuristics
"""
from __future__ import annotations

import re
import logging
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass

import numpy as np
import pandas as pd
from datasketch import MinHash, MinHashLSH

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
    strategy_used: Dict[str, str]
    cells_filled: Dict[str, int]
    total_cells_filled: int
    fill_values: Dict[str, Any]


@dataclass
class OutlierResult:
    method: str
    columns_processed: List[str]
    outliers_detected: Dict[str, int]
    outliers_capped: Dict[str, int]
    bounds: Dict[str, Dict[str, float]]
    total_outliers: int
    total_capped: int


@dataclass
class TypeInferenceResult:
    original_dtypes: Dict[str, str]
    inferred_types: Dict[str, str]
    conversions_applied: Dict[str, str]
    conversion_failures: Dict[str, str]


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
# 1. DUPLICATE REMOVAL  (fast: exact via pandas, fuzzy via MinHash LSH)
# ──────────────────────────────────────────────────────────────────────────────

def _build_row_tokens(row_values: list) -> set:
    tokens: set = set()
    for val in row_values:
        if val is None or (isinstance(val, float) and np.isnan(val)):
            continue
        for token in str(val).lower().split():
            tokens.add(token)
    return tokens or {"__empty__"}


def remove_duplicates(
    df: pd.DataFrame,
    fuzzy_threshold: float = 0.90,
    enable_fuzzy: bool = True,
) -> Tuple[pd.DataFrame, DuplicateRemovalResult]:
    original_rows = len(df)

    # Exact duplicates — O(n)
    exact_mask = df.duplicated(keep="first")
    exact_indices = df.index[exact_mask].tolist()
    df_clean = df[~exact_mask].copy()
    exact_removed = len(exact_indices)
    logger.info("[clean] Exact duplicates removed: %d", exact_removed)

    # Fuzzy duplicates via MinHash LSH — O(n) average
    fuzzy_removed = 0
    fuzzy_pairs: List[Tuple[int, int]] = []

    if enable_fuzzy and len(df_clean) > 1:
        str_cols = df_clean.select_dtypes(include=["object", "string"]).columns.tolist()
        if str_cols:
            try:
                lsh = MinHashLSH(threshold=fuzzy_threshold, num_perm=64)
                minhashes: Dict[str, MinHash] = {}
                rows_list = df_clean[str_cols].values.tolist()
                idx_list = df_clean.index.tolist()

                for idx, row in zip(idx_list, rows_list):
                    m = MinHash(num_perm=64)
                    for token in _build_row_tokens(row):
                        m.update(token.encode("utf-8"))
                    key = str(idx)
                    lsh.insert(key, m)
                    minhashes[key] = m

                to_drop: set = set()
                seen_pairs: set = set()
                for key, m in minhashes.items():
                    if key in to_drop:
                        continue
                    for ckey in lsh.query(m):
                        if ckey == key or ckey in to_drop:
                            continue
                        pair = (min(key, ckey), max(key, ckey))
                        if pair in seen_pairs:
                            continue
                        seen_pairs.add(pair)
                        if m.jaccard(minhashes[ckey]) >= fuzzy_threshold:
                            to_drop.add(ckey)
                            fuzzy_pairs.append((int(key), int(ckey)))

                fuzzy_removed = len(to_drop)
                if to_drop:
                    df_clean = df_clean.drop(index=[int(k) for k in to_drop])
                logger.info("[clean] Fuzzy duplicates removed: %d (threshold=%.2f)", fuzzy_removed, fuzzy_threshold)

            except Exception as exc:
                logger.warning("[clean] Fuzzy dedup failed, skipping: %s", exc)

    return df_clean.reset_index(drop=True), DuplicateRemovalResult(
        exact_removed=exact_removed,
        fuzzy_removed=fuzzy_removed,
        total_removed=exact_removed + fuzzy_removed,
        original_rows=original_rows,
        cleaned_rows=len(df_clean),
        fuzzy_threshold_used=fuzzy_threshold,
        duplicate_row_indices=exact_indices[:500],
        fuzzy_pair_indices=fuzzy_pairs[:100],
    )


# ──────────────────────────────────────────────────────────────────────────────
# 2. MISSING VALUE IMPUTATION
# ──────────────────────────────────────────────────────────────────────────────

def impute_missing_values(
    df: pd.DataFrame,
    strategy: str = "median",
    column_strategies: Optional[Dict[str, str]] = None,
) -> Tuple[pd.DataFrame, MissingValueResult]:
    df_out = df.copy()
    strategy_used: Dict[str, str] = {}
    cells_filled: Dict[str, int] = {}
    fill_values: Dict[str, Any] = {}

    columns_with_missing = [c for c in df_out.columns if df_out[c].isnull().any()]
    if not columns_with_missing:
        return df_out, MissingValueResult(
            strategy_used={}, cells_filled={}, total_cells_filled=0, fill_values={}
        )

    for col in columns_with_missing:
        col_strat = (column_strategies or {}).get(col, strategy)
        n_missing = int(df_out[col].isnull().sum())
        is_numeric = pd.api.types.is_numeric_dtype(df_out[col])
        used_strat = col_strat

        try:
            if col_strat == "drop":
                df_out.dropna(subset=[col], inplace=True)
                fill_values[col] = None

            elif col_strat in ("mean", "median"):
                if is_numeric:
                    val = float(df_out[col].mean() if col_strat == "mean" else df_out[col].median())
                    df_out[col] = df_out[col].fillna(val)
                    fill_values[col] = round(val, 4)
                else:
                    mode_s = df_out[col].mode()
                    val = mode_s.iloc[0] if not mode_s.empty else "Unknown"
                    df_out[col] = df_out[col].fillna(val)
                    fill_values[col] = val
                    used_strat = "mode (fallback)"

            elif col_strat == "mode":
                mode_s = df_out[col].mode()
                val = mode_s.iloc[0] if not mode_s.empty else (0 if is_numeric else "Unknown")
                df_out[col] = df_out[col].fillna(val)
                fill_values[col] = val

            elif col_strat == "forward_fill":
                df_out[col] = df_out[col].ffill()
                fill_values[col] = "propagated"

            elif col_strat == "backward_fill":
                df_out[col] = df_out[col].bfill()
                fill_values[col] = "propagated"

            strategy_used[col] = used_strat
            cells_filled[col] = n_missing

        except Exception as exc:
            logger.warning("[clean] Imputation failed for '%s': %s", col, exc)
            strategy_used[col] = "failed"
            cells_filled[col] = 0
            fill_values[col] = None

    df_out.reset_index(drop=True, inplace=True)
    return df_out, MissingValueResult(
        strategy_used=strategy_used,
        cells_filled=cells_filled,
        total_cells_filled=sum(cells_filled.values()),
        fill_values={k: str(v) if v is not None else None for k, v in fill_values.items()},
    )


# ──────────────────────────────────────────────────────────────────────────────
# 3. OUTLIER DETECTION & CAPPING  (custom thresholds, vectorised clip)
# ──────────────────────────────────────────────────────────────────────────────

def detect_and_cap_outliers(
    df: pd.DataFrame,
    method: str = "iqr",
    cap: bool = True,
    iqr_multiplier: float = 1.5,
    zscore_threshold: float = 3.0,
) -> Tuple[pd.DataFrame, OutlierResult]:
    df_out = df.copy()
    numeric_cols = df_out.select_dtypes(include=np.number).columns.tolist()
    outliers_detected: Dict[str, int] = {}
    outliers_capped: Dict[str, int] = {}
    bounds: Dict[str, Dict[str, float]] = {}

    for col in numeric_cols:
        series = df_out[col]
        valid = series.dropna()
        if valid.empty or valid.nunique() < 2:
            continue

        if method == "iqr":
            q1, q3 = float(valid.quantile(0.25)), float(valid.quantile(0.75))
            iqr = q3 - q1
            if iqr == 0:
                continue
            lower = q1 - iqr_multiplier * iqr
            upper = q3 + iqr_multiplier * iqr
        else:  # zscore
            mean, std = float(valid.mean()), float(valid.std())
            if std == 0:
                continue
            lower = mean - zscore_threshold * std
            upper = mean + zscore_threshold * std

        mask = (series < lower) | (series > upper)
        n_out = int(mask.sum())
        outliers_detected[col] = n_out
        bounds[col] = {"lower": round(lower, 4), "upper": round(upper, 4)}

        if cap and n_out > 0:
            df_out[col] = series.clip(lower=lower, upper=upper)
            outliers_capped[col] = n_out
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
# 4. TYPE INFERENCE  (samples 200 rows, regex + cardinality)
# ──────────────────────────────────────────────────────────────────────────────

_RE_INTEGER = re.compile(r"^-?\d+$")
_RE_FLOAT   = re.compile(r"^-?\d+(\.\d+)?([eE][+-]?\d+)?$")
_RE_BOOL    = re.compile(r"^(true|false|yes|no|1|0|t|f|y|n)$", re.I)
_RE_DATE    = re.compile(
    r"^\d{4}[-/]\d{2}[-/]\d{2}"
    r"|^\d{2}[-/]\d{2}[-/]\d{4}"
    r"|^\d{4}\d{2}\d{2}$"
)


def _infer_column_type(series: pd.Series) -> str:
    sample = series.dropna().astype(str).head(200)
    if sample.empty:
        return "unknown"
    n = len(sample)
    if sample.str.match(_RE_BOOL).sum() / n >= 0.90:
        return "boolean"
    if sample.str.match(_RE_INTEGER).sum() / n >= 0.90:
        return "integer"
    if sample.str.match(_RE_FLOAT).sum() / n >= 0.90:
        return "float"
    if sample.str.match(_RE_DATE).sum() / n >= 0.85:
        return "datetime"
    numeric_vals = pd.to_numeric(sample, errors="coerce")
    if numeric_vals.notna().mean() >= 0.90:
        return "integer" if (numeric_vals.dropna() % 1 == 0).all() else "float"
    n_unique = series.nunique()
    total = max(len(series.dropna()), 1)
    if n_unique / total < 0.10 and n_unique <= 30:
        return "categorical"
    return "string"


def _try_convert(df: pd.DataFrame, col: str, target_type: str) -> Tuple[pd.DataFrame, bool, str]:
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
            df[col] = pd.to_datetime(df[col], errors="coerce")
        elif target_type == "categorical":
            df[col] = df[col].astype("category")
        return df, True, ""
    except Exception as exc:
        return df, False, str(exc)


def infer_and_convert_types(
    df: pd.DataFrame,
    apply_conversions: bool = True,
) -> Tuple[pd.DataFrame, TypeInferenceResult]:
    df_out = df.copy()
    original_dtypes = {c: str(dt) for c, dt in df.dtypes.items()}
    inferred_types: Dict[str, str] = {}
    conversions_applied: Dict[str, str] = {}
    conversion_failures: Dict[str, str] = {}

    for col in df_out.columns:
        current_dtype = str(df_out[col].dtype)
        if current_dtype not in ("object", "string", "O"):
            inferred_types[col] = current_dtype
            continue
        inferred = _infer_column_type(df_out[col])
        inferred_types[col] = inferred
        if not apply_conversions or inferred in ("string", "unknown"):
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
# 5. PIPELINE ORCHESTRATOR
# ──────────────────────────────────────────────────────────────────────────────

def run_cleaning_pipeline(
    df: pd.DataFrame,
    *,
    remove_exact_duplicates: bool = True,
    remove_fuzzy_duplicates: bool = True,
    fuzzy_threshold: float = 0.90,
    impute_missing: bool = True,
    imputation_strategy: str = "median",
    column_strategies: Optional[Dict[str, str]] = None,
    handle_outliers: bool = True,
    outlier_method: str = "iqr",
    cap_outliers: bool = True,
    iqr_multiplier: float = 1.5,
    zscore_threshold: float = 3.0,
    infer_types: bool = True,
    apply_type_conversions: bool = True,
) -> Tuple[pd.DataFrame, CleaningReport]:
    original_shape = df.shape
    operations_applied: List[str] = []
    df_work = df

    type_result: Optional[TypeInferenceResult] = None
    if infer_types:
        logger.info("[clean] 1/4 type inference")
        df_work, type_result = infer_and_convert_types(df_work, apply_conversions=apply_type_conversions)
        if type_result.conversions_applied:
            operations_applied.append(f"type_inference ({len(type_result.conversions_applied)} cols converted)")

    dup_result: Optional[DuplicateRemovalResult] = None
    if remove_exact_duplicates:
        logger.info("[clean] 2/4 duplicate removal (%d rows)", len(df_work))
        df_work, dup_result = remove_duplicates(
            df_work, fuzzy_threshold=fuzzy_threshold, enable_fuzzy=remove_fuzzy_duplicates
        )
        if dup_result.total_removed > 0:
            operations_applied.append(
                f"duplicate_removal ({dup_result.exact_removed} exact, {dup_result.fuzzy_removed} fuzzy)"
            )

    missing_result: Optional[MissingValueResult] = None
    if impute_missing:
        logger.info("[clean] 3/4 imputation strategy=%s", imputation_strategy)
        df_work, missing_result = impute_missing_values(
            df_work, strategy=imputation_strategy, column_strategies=column_strategies
        )
        if missing_result.total_cells_filled > 0:
            operations_applied.append(
                f"imputation ({missing_result.total_cells_filled} cells, {imputation_strategy})"
            )

    outlier_result: Optional[OutlierResult] = None
    if handle_outliers:
        logger.info("[clean] 4/4 outlier detection method=%s", outlier_method)
        df_work, outlier_result = detect_and_cap_outliers(
            df_work,
            method=outlier_method,
            cap=cap_outliers,
            iqr_multiplier=iqr_multiplier,
            zscore_threshold=zscore_threshold,
        )
        if outlier_result.total_outliers > 0:
            operations_applied.append(
                f"outlier_handling ({outlier_result.total_outliers} detected, {outlier_result.total_capped} capped)"
            )

    return df_work, CleaningReport(
        duplicate_result=dup_result,
        missing_value_result=missing_result,
        outlier_result=outlier_result,
        type_inference_result=type_result,
        original_shape=original_shape,
        final_shape=df_work.shape,
        operations_applied=operations_applied,
    )
