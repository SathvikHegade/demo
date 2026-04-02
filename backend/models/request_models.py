"""
Request models for DataForge API.
"""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class AnalysisConfig(BaseModel):
    """Configuration options for dataset analysis."""

    sensitive_columns: List[str] = Field(
        default_factory=list,
        description="Columns containing sensitive demographic attributes.",
        examples=[["gender", "race", "age"]],
    )
    target_column: Optional[str] = Field(
        default=None,
        description="The label / target column for supervised-learning tasks.",
    )
    bias_threshold: float = Field(
        default=0.70,
        ge=0.0,
        le=1.0,
        description="Fraction above which a single value dominates — triggers a bias flag.",
    )
    outlier_method: str = Field(
        default="iqr",
        pattern="^(iqr|zscore)$",
        description="Method used for outlier detection: 'iqr' or 'zscore'.",
    )
    fuzzy_duplicate_threshold: float = Field(
        default=0.85,
        ge=0.0,
        le=1.0,
        description="Similarity score (0–1) above which two rows are considered fuzzy duplicates.",
    )
    run_nlp: bool = Field(
        default=True,
        description="Whether to run NLP analysis on text columns.",
    )
