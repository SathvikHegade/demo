"""
Response models for DataForge API.
FIXED: Added grade, dimension_scores fields to QualityReport.
       status default changed to "complete" per contract.
       Added size_kb alias for dataset_info compatibility.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DatasetInfo(BaseModel):
    rows: int
    columns: int
    size_mb: float
    size_kb: float = 0.0        # ADDED: contract includes size_kb
    column_names: List[str]
    dtypes: Dict[str, str]
    missing_summary: Dict[str, float]

    def model_post_init(self, __context: Any) -> None:
        if self.size_kb == 0.0 and self.size_mb:
            object.__setattr__(self, 'size_kb', round(self.size_mb * 1024, 2))


class Issue(BaseModel):
    id: str
    category: str               # bias | noise | duplicate | imbalance
    severity: str               # CRITICAL | WARNING | INFO
    column: Optional[str] = None
    description: str
    metric_value: float
    threshold: float = 0.0
    recommendation: str
    estimated_impact: str


class ColumnBiasDetail(BaseModel):
    column: str
    bias_type: str
    dominant_value: Optional[str] = None
    dominant_fraction: float
    disparate_impact_ratio: Optional[float] = None
    statistical_parity_diff: Optional[float] = None
    proxy_correlation: Optional[float] = None
    is_proxy: bool = False
    bias_score: float


class BiasReport(BaseModel):
    overall_bias_score: float
    affected_columns: List[str]
    details: List[ColumnBiasDetail]
    fairness_metrics: Dict[str, Any]


class OutlierDetail(BaseModel):
    column: str
    method: str
    outlier_count: int
    outlier_fraction: float
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None
    suggested_cap_value: Optional[float] = None


class NoiseReport(BaseModel):
    missing_value_columns: List[str]
    total_missing_cells: int
    missing_fraction: float
    outlier_details: List[OutlierDetail]
    formatting_errors: Dict[str, int]
    constant_columns: List[str]
    high_cardinality_columns: List[str]


class DuplicateReport(BaseModel):
    exact_duplicate_rows: int
    exact_duplicate_fraction: float
    near_duplicate_pairs: int
    near_duplicate_fraction: float
    duplicate_columns: List[str]


class ClassDetail(BaseModel):
    label: str
    count: int
    fraction: float


class ImbalanceReport(BaseModel):
    target_column: Optional[str]
    class_distribution: List[ClassDetail]
    imbalance_ratio: float
    is_imbalanced: bool
    recommended_strategy: str


class NLPColumnDetail(BaseModel):
    column: str
    sample_size: int
    pii_detected: bool
    pii_types: List[str]
    language_mix: Dict[str, float]
    avg_readability_score: Optional[float] = None
    entity_leakage: bool
    entity_types_found: List[str]
    encoding_issues: int


class NLPReport(BaseModel):
    text_columns_analyzed: List[str]
    details: List[NLPColumnDetail]


class QualityReport(BaseModel):
    job_id: str
    status: str = "complete"                    # FIXED: was "completed"
    dataset_info: DatasetInfo
    overall_quality_score: float = Field(ge=0.0, le=100.0)
    grade: str = "C"                            # ADDED: A|B|C|D|F per contract
    executive_summary: str
    issues: List[Issue]
    dimension_scores: Dict[str, float] = Field(  # ADDED: per contract
        default_factory=lambda: {
            "completeness": 0.0, "uniqueness": 0.0,
            "consistency": 0.0, "validity": 0.0, "balance": 0.0
        }
    )
    bias_report: BiasReport
    noise_report: NoiseReport
    duplicate_report: DuplicateReport
    imbalance_report: ImbalanceReport
    nlp_report: NLPReport
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class JobStatus(BaseModel):
    job_id: str
    status: str                    # queued | processing | complete | failed
    progress: float = 0.0          # ADDED: 0.0-1.0 for polling UI
    stage: str = ""                # ADDED: human-readable stage name
    message: Optional[str] = None
