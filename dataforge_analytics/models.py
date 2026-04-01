from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class OutlierReport(BaseModel):
    column_name: str
    outlier_count: int
    outlier_indices: List[int]
    outlier_percentage: float
    method_used: str
    bounds: Dict[str, float]

class DataTypeNoiseReport(BaseModel):
    affected_columns: List[str]
    type_mismatch_count: int
    format_inconsistencies: Dict[str, List[str]]

class ValueNoiseReport(BaseModel):
    noisy_value_count: int
    affected_columns: List[str]
    grouped_categories: Dict[str, Dict[str, str]]

class StructuralNoiseReport(BaseModel):
    empty_rows: List[int]
    low_variance_columns: List[str]
    constant_columns: List[str]

class ImbalanceMetrics(BaseModel):
    class_counts: Dict[str, int]
    percentages: Dict[str, float]
    imbalance_ratio: float
    shannon_entropy: float
    gini_impurity: float
    effective_samples: Dict[str, float]

class RebalanceRecommendation(BaseModel):
    strategy: str
    when_to_use: str
    pros: str
    cons: str
    estimated_samples_generated: int

class ImbalanceReport(BaseModel):
    target_column: str
    metrics: ImbalanceMetrics
    severity: str
    recommendations: List[RebalanceRecommendation]
    drift_vulnerability_score: float

class DuplicateExactReport(BaseModel):
    duplicate_count: int
    duplicate_groups: List[List[int]]
    memory_wasted_mb: float

class SemanticDuplicateReport(BaseModel):
    semantic_duplicate_groups: List[List[int]]
    confidence_scores: List[float]

class NearDuplicateReport(BaseModel):
    near_duplicate_pairs: List[tuple[int, int]]
    similarity_scores: List[float]
    suggested_merges: List[List[int]]

class CrossColumnReport(BaseModel):
    redundant_column_pairs: List[tuple[str, str]]
    correlation_matrix: Dict[str, Dict[str, float]]

class QualityScoreReport(BaseModel):
    overall_score: float
    completeness_score: float
    uniqueness_score: float
    consistency_score: float
    validity_score: float
    balance_score: float
    letter_grade: str
    key_issues: List[str]
    improvements: Dict[str, float]

class ColumnProfile(BaseModel):
    column_name: str
    dtype: str
    inferred_type: str
    unique_count: int
    unique_ratio: float
    missing_count: int
    missing_percentage: float
    stats: Dict[str, Any]

class ProfileReport(BaseModel):
    dataset_shape: tuple[int, int]
    columns: List[ColumnProfile]
