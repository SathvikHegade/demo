import pandas as pd
from dataforge_analytics.imbalance_analyzer import analyze_imbalance

def test_imbalance():
    df = pd.DataFrame({'target': ['A', 'A', 'A', 'A', 'B']})
    res = analyze_imbalance(df, 'target')
    assert res.severity in ['MODERATE', 'SEVERE', 'EXTREME']
    assert len(res.recommendations) > 0
