import pandas as pd
from dataforge_analytics.quality_scorer import calculate_quality_score

def test_quality_scorer():
    df = pd.DataFrame({'A': [1, 2, 3], 'B': [3, None, 3]})
    res = calculate_quality_score(df)
    assert 0 <= res.overall_score <= 100
    assert res.letter_grade in ['A', 'B', 'C', 'D', 'F']
