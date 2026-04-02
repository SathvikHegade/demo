"""
nlp_analyzer.py — PII detection, language mix, entity leakage, readability.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Dict, List, Optional

import pandas as pd

from models.response_models import NLPColumnDetail, NLPReport

# ─── PII patterns ─────────────────────────────────────────────────────────────
_PII_PATTERNS: Dict[str, re.Pattern] = {
    "email": re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"),
    "phone": re.compile(
        r"(\+?\d[\d\s\-().]{7,}\d)"
    ),
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "credit_card": re.compile(r"\b(?:\d[ -]?){13,16}\b"),
    "ip_address": re.compile(
        r"\b(?:\d{1,3}\.){3}\d{1,3}\b"
    ),
}

# ─── Readability ──────────────────────────────────────────────────────────────

def _flesch_reading_ease(text: str) -> Optional[float]:
    """Approximate Flesch Reading Ease score (higher = easier)."""
    sentences = re.split(r"[.!?]+", text)
    sentences = [s.strip() for s in sentences if s.strip()]
    words = re.findall(r"\b\w+\b", text)
    syllables = sum(_count_syllables(w) for w in words)

    if not sentences or not words:
        return None

    avg_sent_len = len(words) / len(sentences)
    avg_syll = syllables / len(words)
    score = 206.835 - 1.015 * avg_sent_len - 84.6 * avg_syll
    return round(max(0.0, min(100.0, score)), 2)


def _count_syllables(word: str) -> int:
    word = word.lower()
    vowels = "aeiouy"
    count = sum(1 for i, ch in enumerate(word) if ch in vowels and (i == 0 or word[i - 1] not in vowels))
    if word.endswith("e") and count > 1:
        count -= 1
    return max(1, count)


# ─── Encoding issues ──────────────────────────────────────────────────────────

def _count_encoding_issues(series: pd.Series) -> int:
    """Count cells containing replacement characters or control sequences."""
    bad = 0
    for val in series.dropna():
        s = str(val)
        if "\ufffd" in s or any(unicodedata.category(c) == "Cc" for c in s):
            bad += 1
    return bad


# ─── Language detection (lightweight — no external model required) ─────────────

_EN_STOPWORDS = {"the", "is", "at", "which", "on", "a", "an", "and", "or", "of", "to"}
_ES_STOPWORDS = {"el", "la", "los", "las", "es", "en", "y", "de", "del", "que"}
_FR_STOPWORDS = {"le", "la", "les", "est", "et", "de", "du", "un", "une", "je"}

def _detect_language_mix(series: pd.Series, sample_n: int = 200) -> Dict[str, float]:
    """
    Rough language distribution using stopword heuristics.
    Returns fraction of sampled cells classified per language.
    """
    sample = series.dropna().astype(str).sample(min(len(series), sample_n), random_state=42)
    counts: Dict[str, int] = {"en": 0, "es": 0, "fr": 0, "other": 0}
    for text in sample:
        tokens = set(re.findall(r"\b\w+\b", text.lower()))
        scores = {
            "en": len(tokens & _EN_STOPWORDS),
            "es": len(tokens & _ES_STOPWORDS),
            "fr": len(tokens & _FR_STOPWORDS),
        }
        best = max(scores, key=scores.get)  # type: ignore[arg-type]
        if scores[best] == 0:
            counts["other"] += 1
        else:
            counts[best] += 1

    total = max(sum(counts.values()), 1)
    return {k: round(v / total, 4) for k, v in counts.items() if v > 0}


# ─── spaCy NER (lazy import so the module loads even without the model) ───────

def _spacy_entity_leakage(texts: List[str]) -> tuple[bool, List[str]]:
    """
    Run spaCy NER on a sample of texts to detect entity leakage.
    Returns (leakage_detected, entity_types_found).
    Falls back gracefully if spaCy / the model is unavailable.
    """
    try:
        import spacy
        nlp = spacy.load("en_core_web_sm", disable=["parser", "tagger"])
    except Exception:
        return False, []

    entity_types: set[str] = set()
    sensitive_types = {"PERSON", "ORG", "GPE", "LOC", "NORP", "FAC"}

    for text in texts[:100]:  # limit for speed
        doc = nlp(str(text)[:512])
        for ent in doc.ents:
            if ent.label_ in sensitive_types:
                entity_types.add(ent.label_)

    leakage = bool(entity_types & sensitive_types)
    return leakage, list(entity_types)


# ─── Main analysis function ───────────────────────────────────────────────────

def _is_text_column(series: pd.Series, min_avg_len: int = 20) -> bool:
    """Heuristic: a column is 'text' if its values are long strings."""
    if series.dtype != object:
        return False
    avg_len = series.dropna().astype(str).str.len().mean()
    return float(avg_len) >= min_avg_len


async def run_nlp_analysis(df: pd.DataFrame) -> NLPReport:
    """
    Run NLP analysis on all text-like columns in the dataset.

    Detects PII, language mix, encoding problems, and entity leakage.
    Uses spaCy en_core_web_sm when available; degrades gracefully otherwise.
    """
    text_columns = [c for c in df.columns if _is_text_column(df[c])]

    details: List[NLPColumnDetail] = []

    for col in text_columns:
        series = df[col].dropna().astype(str)
        sample = series.sample(min(len(series), 500), random_state=42)

        # ── PII ──────────────────────────────────────────────────────────────
        combined_text = " ".join(sample)
        pii_types_found = [
            pii_name
            for pii_name, pattern in _PII_PATTERNS.items()
            if pattern.search(combined_text)
        ]
        pii_detected = len(pii_types_found) > 0

        # ── Language ─────────────────────────────────────────────────────────
        lang_mix = _detect_language_mix(series)

        # ── Readability ───────────────────────────────────────────────────────
        sample_texts = sample.tolist()[:50]
        readability_scores = [_flesch_reading_ease(t) for t in sample_texts]
        valid_scores = [s for s in readability_scores if s is not None]
        avg_readability = round(sum(valid_scores) / len(valid_scores), 2) if valid_scores else None

        # ── Encoding ─────────────────────────────────────────────────────────
        encoding_issues = _count_encoding_issues(series)

        # ── Entity leakage (spaCy) ────────────────────────────────────────────
        entity_leakage, entity_types = _spacy_entity_leakage(sample_texts)

        details.append(
            NLPColumnDetail(
                column=col,
                sample_size=len(sample),
                pii_detected=pii_detected,
                pii_types=pii_types_found,
                language_mix=lang_mix,
                avg_readability_score=avg_readability,
                entity_leakage=entity_leakage,
                entity_types_found=entity_types,
                encoding_issues=encoding_issues,
            )
        )

    return NLPReport(
        text_columns_analyzed=text_columns,
        details=details,
    )
