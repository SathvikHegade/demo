import pandas as pd
import numpy as np
from scipy.stats import entropy
from typing import Dict, Any, List
from .models import ImbalanceReport, ImbalanceMetrics, RebalanceRecommendation
from .constants import IMBALANCE_CATEGORIES

def _get_severity(ratio: float) -> str:
    for cat, (low, high) in IMBALANCE_CATEGORIES.items():
        if low <= ratio < high:
            return cat
    return "EXTREME"

def analyze_imbalance(df: pd.DataFrame, target_column: str) -> ImbalanceReport:
    """Analyze class imbalance in a target column."""
    if target_column not in df.columns:
        raise ValueError(f"Column {target_column} not found.")
        
    counts = df[target_column].value_counts().to_dict()
    if not counts:
        raise ValueError(f"Column {target_column} is empty.")
        
    total = sum(counts.values())
    percentages = {k: v / total for k, v in counts.items()}
    
    max_count = max(counts.values())
    min_count = min(counts.values()) if len(counts) > 1 else max_count
    ratio = max_count / min_count if min_count > 0 else float('inf')
    
    # Entropy
    probs = list(percentages.values())
    shannon = entropy(probs, base=2)
    gini = 1.0 - sum(p**2 for p in probs)
    
    severity = _get_severity(ratio)
    
    recs = []
    if ratio > 1.5:
        recs.append(RebalanceRecommendation(
            strategy="SMOTE",
            when_to_use="When features are continuous numeric",
            pros="Creates synthetic samples rather than duplicating",
            cons="Can introduce noise, doesn't work well on high-dim categorical data",
            estimated_samples_generated=max_count - min_count
        ))
        recs.append(RebalanceRecommendation(
            strategy="Class Weights",
            when_to_use="When algorithm supports cost-sensitive learning",
            pros="No data manipulation required",
            cons="Only works for specific algorithms",
            estimated_samples_generated=0
        ))
        
    # Novel metrics: Drift Vulnerability Score
    drift_vuln = min(1.0, ratio / 10.0 + (1 - shannon))
    
    metrics = ImbalanceMetrics(
        class_counts=counts,
        percentages=percentages,
        imbalance_ratio=float(ratio),
        shannon_entropy=float(shannon),
        gini_impurity=float(gini),
        effective_samples={str(k): float(v) for k, v in counts.items()}
    )
    
    return ImbalanceReport(
        target_column=target_column,
        metrics=metrics,
        severity=severity,
        recommendations=recs,
        drift_vulnerability_score=float(drift_vuln)
    )
