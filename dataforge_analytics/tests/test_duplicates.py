import pandas as pd
from dataforge_analytics.duplicate_detector import detect_exact_duplicates

def test_duplicates():
    df = pd.DataFrame({'A': [1, 2, 1], 'B': [3, 4, 3]})
    res = detect_exact_duplicates(df)
    assert res.duplicate_count > 0
