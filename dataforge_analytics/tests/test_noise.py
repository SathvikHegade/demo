import numpy as np
import pandas as pd
from dataforge_analytics.noise_detector import detect_outliers, detect_datatype_noise, detect_value_noise, detect_structural_noise
from dataforge_analytics.imbalance_analyzer import analyze_imbalance
from dataforge_analytics.duplicate_detector import detect_exact_duplicates, detect_cross_column_redundancy
from dataforge_analytics.quality_scorer import calculate_quality_score
from dataforge_analytics.profiler import profile_dataset

def test_outliers():
    df = pd.DataFrame({'val': [1, 2, 3, 4, 100]})
    res = detect_outliers(df, 'val')
    assert res.outlier_count == 1
    assert 100 in df.loc[res.outlier_indices, 'val'].values

def test_data_type():
    df = pd.DataFrame({'val': ['1', '2', '3']})
    res = detect_datatype_noise(df)
    assert isinstance(res.type_mismatch_count, int)

def test_structural():
    df = pd.DataFrame({'A': [1, 1, 1], 'B': [1, 2, 3], 'C': [np.nan, np.nan, np.nan]})
    res = detect_structural_noise(df)
    assert 'A' in res.constant_columns
    assert res.empty_rows == []
