"""
duplicate_detector.py — Member 2's duplicate detection.
FIXED: replaced python-Levenshtein with rapidfuzz.distance for semantic duplicates.
"""
import pandas as pd
import numpy as np
from typing import List
from datasketch import MinHash, MinHashLSH
from .models import DuplicateExactReport, SemanticDuplicateReport, NearDuplicateReport, CrossColumnReport


def detect_exact_duplicates(df: pd.DataFrame) -> DuplicateExactReport:
    """Detect full row exact duplicates."""
    dupes = df[df.duplicated(keep=False)]
    groups = []
    if not dupes.empty:
        for _, group in dupes.groupby(list(df.columns), dropna=False):
            groups.append(group.index.tolist())

    memory_wasted = dupes.memory_usage(deep=True).sum() / (1024 ** 2) if not dupes.empty else 0.0

    return DuplicateExactReport(
        duplicate_count=len(df[df.duplicated()]),
        duplicate_groups=groups,
        memory_wasted_mb=float(memory_wasted)
    )


def detect_near_duplicates(df: pd.DataFrame, threshold: float = 0.9) -> NearDuplicateReport:
    """Detect near duplicates using MinHash LSH."""
    str_cols = df.select_dtypes(include=['object', 'string']).columns
    if len(str_cols) == 0:
        return NearDuplicateReport(near_duplicate_pairs=[], similarity_scores=[], suggested_merges=[])

    lsh = MinHashLSH(threshold=threshold, num_perm=128)
    minhashes = {}

    for idx, row in df.iterrows():
        m = MinHash(num_perm=128)
        text = " ".join([str(val) for val in row[str_cols] if not pd.isna(val)])
        for word in text.split():
            m.update(word.encode('utf8'))
        lsh.insert(str(idx), m)
        minhashes[str(idx)] = m

    pairs, scores, merges = [], [], []
    seen = set()

    for idx, m in minhashes.items():
        result = lsh.query(m)
        for r_idx in result:
            if idx != r_idx and (r_idx, idx) not in seen:
                seen.add((idx, r_idx))
                sim = m.jaccard(minhashes[r_idx])
                if sim >= threshold:
                    pairs.append((int(idx), int(r_idx)))
                    scores.append(float(sim))
                    merges.append([int(idx), int(r_idx)])

    return NearDuplicateReport(near_duplicate_pairs=pairs, similarity_scores=scores, suggested_merges=merges)


def detect_semantic_duplicates(df: pd.DataFrame, columns: List[str]) -> SemanticDuplicateReport:
    """Detect semantic duplicate strings using rapidfuzz Levenshtein distance."""
    # FIXED: was using python-Levenshtein, replaced with rapidfuzz
    try:
        from rapidfuzz.distance import Levenshtein
        ratio_fn = lambda a, b: Levenshtein.normalized_similarity(a, b)
    except ImportError:
        ratio_fn = lambda a, b: 0.0

    groups, scores = [], []

    for col in columns:
        if col in df.columns and (pd.api.types.is_object_dtype(df[col]) or pd.api.types.is_string_dtype(df[col])):
            s = df[col].dropna().astype(str).unique()
            if 1 < len(s) < 1000:
                for i in range(len(s)):
                    for j in range(i + 1, len(s)):
                        sim = ratio_fn(s[i], s[j])
                        if sim >= 0.85:
                            g = df[df[col].isin([s[i], s[j]])].index.tolist()
                            groups.append(g)
                            scores.append(float(sim))

    return SemanticDuplicateReport(semantic_duplicate_groups=groups, confidence_scores=scores)


def detect_cross_column_redundancy(df: pd.DataFrame) -> CrossColumnReport:
    """Detect redundant columns that are highly correlated."""
    num_df = df.select_dtypes(include=[np.number])
    corr_matrix = {}
    redundant_pairs = []

    if num_df.shape[1] > 1:
        corr = num_df.corr().abs()
        for i in range(len(corr.columns)):
            for j in range(i + 1, len(corr.columns)):
                val = corr.iloc[i, j]
                if not pd.isna(val) and val > 0.98:
                    redundant_pairs.append((corr.columns[i], corr.columns[j]))

        for col in corr.columns:
            corr_matrix[col] = corr[col].fillna(0).to_dict()

    return CrossColumnReport(
        redundant_column_pairs=redundant_pairs,
        correlation_matrix=corr_matrix
    )
