import pandas as pd
from typing import Any, Dict
from .models import ProfileReport, ColumnProfile

def profile_dataset(df: pd.DataFrame) -> ProfileReport:
    """Generate a high-level statistical profile of the dataset."""
    columns = []
    
    for col in df.columns:
        series = df[col]
        total = len(series)
        missing = series.isna().sum()
        unique = series.nunique(dropna=True)
        
        dtype = str(series.dtype)
        inferred = pd.api.types.infer_dtype(series, skipna=True)
        
        stats: Dict[str, Any] = {}
        if pd.api.types.is_numeric_dtype(series):
            stats = {
                "mean": float(series.mean()),
                "std": float(series.std()),
                "min": float(series.min()),
                "max": float(series.max()),
                "skew": float(series.skew())
            }
        
        col_prof = ColumnProfile(
            column_name=str(col),
            dtype=dtype,
            inferred_type=inferred,
            unique_count=int(unique),
            unique_ratio=float(unique / total) if total > 0 else 0.0,
            missing_count=int(missing),
            missing_percentage=float(missing / total) if total > 0 else 0.0,
            stats=stats
        )
        columns.append(col_prof)
        
    return ProfileReport(
        dataset_shape=df.shape,
        columns=columns
    )
