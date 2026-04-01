import pandas as pd
import numpy as np
from dataforge_analytics import (
    detect_outliers,
    analyze_imbalance,
    detect_exact_duplicates,
    calculate_quality_score,
    profile_dataset
)

def main():
    print("Generating synthetic dirty dataset...")
    df = pd.DataFrame({
        'id': [1, 2, 3, 4, 5, 5],
        'age': [25, 30, 9999, 22, 28, 28],
        'income': [50000, 60000, 1500000, 45000, 52000, 52000],
        'target': ['Yes', 'No', 'No', 'No', 'No', 'No']
    })
    
    print("\n--- 1. PROFILING ---")
    prof = profile_dataset(df)
    print(f"Columns processed: {len(prof.columns)}")
    
    print("\n--- 2. OUTLIERS (Income via IQR) ---")
    out = detect_outliers(df, 'income', 'iqr')
    print(f"Outliers detected: {out.outlier_count}")
    
    print("\n--- 3. DATA DUPLICATION ---")
    dup = detect_exact_duplicates(df)
    print(f"Exact duplicates: {dup.duplicate_count}")
    
    print("\n--- 4. CLASS IMBALANCE ---")
    imb = analyze_imbalance(df, 'target')
    print(f"Severity: {imb.severity} | Score: {imb.drift_vulnerability_score:.2f}")
    
    print("\n--- 5. OVERALL SCORE ---")
    score = calculate_quality_score(df)
    print(f"Score: {score.overall_score:.1f}/100 | Grade: {score.letter_grade}")
    print("\nAnalysis Complete!")

if __name__ == "__main__":
    main()
