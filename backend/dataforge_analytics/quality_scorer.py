import pandas as pd
from typing import List, Dict
from .models import QualityScoreReport

def get_letter_grade(score: float) -> str:
    if score >= 90: return 'A'
    if score >= 80: return 'B'
    if score >= 70: return 'C'
    if score >= 60: return 'D'
    return 'F'

def calculate_quality_score(df: pd.DataFrame) -> QualityScoreReport:
    """Calculate the DataForge Quality Score (DQS)."""
    if df.empty:
        return QualityScoreReport(
            overall_score=0, completeness_score=0, uniqueness_score=0, consistency_score=0,
            validity_score=0, balance_score=0, letter_grade='F', key_issues=["Empty dataset"], improvements={}
        )
        
    total_cells = df.shape[0] * df.shape[1]
    missing = df.isna().sum().sum()
    
    completeness = max(0.0, 100 * (1 - (missing / total_cells))) if total_cells > 0 else 100.0
    
    dupes = df.duplicated().sum()
    uniqueness = max(0.0, 100 * (1 - (dupes / df.shape[0]))) if df.shape[0] > 0 else 100.0
    
    consistency = 95.0 # Stub based on datatype noise
    validity = 90.0    # Stub based on outliers
    balance = 85.0     # Stub based on imbalance
    
    overall = (completeness * 0.3) + (uniqueness * 0.2) + (consistency * 0.2) + (validity * 0.15) + (balance * 0.15)
    
    return QualityScoreReport(
        overall_score=float(overall),
        completeness_score=float(completeness),
        uniqueness_score=float(uniqueness),
        consistency_score=float(consistency),
        validity_score=float(validity),
        balance_score=float(balance),
        letter_grade=get_letter_grade(overall),
        key_issues=["Handle missing values", "Address outliers in numeric fields"],
        improvements={"Handling Missing": 5.0, "Deduplication": 2.0}
    )
