"""
cleaning_models.py — Pydantic models for the /api/clean endpoint.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field


# ──────────────────────────────────────────────────────────────────────────────
# Request
# ──────────────────────────────────────────────────────────────────────────────

class CleaningConfig(BaseModel):
    """Configuration for the data cleaning pipeline."""

    # Duplicate removal
    remove_exact_duplicates: bool = Field(True, description="Remove exact duplicate rows.")
    remove_fuzzy_duplicates: bool = Field(True, description="Remove near-duplicate rows using similarity.")
    fuzzy_threshold: float = Field(
        0.90, ge=0.0, le=1.0,
        description="Similarity threshold (0–1) for fuzzy duplicate detection.",
    )

    # Missing value imputation
    impute_missing: bool = Field(True, description="Fill missing values.")
    imputation_strategy: str = Field(
        "median",
        pattern="^(mean|median|mode|forward_fill|backward_fill|drop)$",
        description="Global imputation strategy.",
    )
    column_strategies: Optional[Dict[str, str]] = Field(
        None, description="Per-column strategy overrides."
    )

    # Outlier handling
    handle_outliers: bool = Field(True, description="Detect and optionally cap outliers.")
    outlier_method: str = Field(
        "iqr", pattern="^(iqr|zscore)$",
        description="Outlier detection method.",
    )
    cap_outliers: bool = Field(True, description="Cap outliers at bounds instead of removing.")

    # Type inference
    infer_types: bool = Field(True, description="Auto-infer and convert column types.")
    apply_type_conversions: bool = Field(True, description="Apply the inferred type conversions.")


# ──────────────────────────────────────────────────────────────────────────────
# Response sub-models
# ──────────────────────────────────────────────────────────────────────────────

class DuplicateRemovalSummary(BaseModel):
    exact_removed: int
    fuzzy_removed: int
    total_removed: int
    original_rows: int
    cleaned_rows: int
    fuzzy_threshold_used: float
    sample_duplicate_indices: List[int]
    sample_fuzzy_pairs: List[List[int]]


class MissingValueSummary(BaseModel):
    strategy_used: Dict[str, str]
    cells_filled: Dict[str, int]
    total_cells_filled: int
    fill_values: Dict[str, Optional[str]]


class OutlierSummary(BaseModel):
    method: str
    columns_processed: List[str]
    outliers_detected: Dict[str, int]
    outliers_capped: Dict[str, int]
    bounds: Dict[str, Dict[str, float]]
    total_outliers: int
    total_capped: int


class TypeInferenceSummary(BaseModel):
    original_dtypes: Dict[str, str]
    inferred_types: Dict[str, str]
    conversions_applied: Dict[str, str]
    conversion_failures: Dict[str, str]


class CleaningJobStatus(BaseModel):
    job_id: str
    status: str          # processing | complete | failed
    progress: float = 0.0
    stage: str = ""
    message: Optional[str] = None


class CleaningReport(BaseModel):
    job_id: str
    status: str = "complete"
    original_shape: List[int]        # [rows, cols]
    final_shape: List[int]
    operations_applied: List[str]
    duplicate_summary: Optional[DuplicateRemovalSummary] = None
    missing_value_summary: Optional[MissingValueSummary] = None
    outlier_summary: Optional[OutlierSummary] = None
    type_inference_summary: Optional[TypeInferenceSummary] = None
    download_token: str              # UUID to fetch the cleaned CSV
    rows_removed: int
    cells_cleaned: int
