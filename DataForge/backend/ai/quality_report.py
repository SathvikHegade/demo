from __future__ import annotations

import json
import os
import re
import warnings
from datetime import date
from typing import Any, Dict, Optional

import pandas as pd

try:
    import google.generativeai as genai  # type: ignore[import-not-found]
except Exception:  # pragma: no cover
    genai = None  # type: ignore


DATAFORGE_QUALITY_REPORT_PROMPT = """
You are a professional data quality analyst. Generate a comprehensive data quality report in JSON format that will be used to create a PDF report.

INPUT CSV DATA:
{csv_data}

ANALYSIS REQUIREMENTS:

1. EXECUTIVE SUMMARY
Provide a 3-4 sentence summary covering:
- Total rows and primary quality issues
- Most critical problems (bias, integrity flaws, outliers)
- Specific problematic columns with metrics
- Impact on model performance and reliability

2. CORE METRICS
Calculate:
- Total rows
- Total columns
- Dataset size in MB
- Overall quality score (0-100) based on weighted average of:
  * Completeness (30%): (1 - missing_ratio) * 100
  * Uniqueness (20%): (unique_values / total_values) * 100 for ID columns
  * Consistency (20%): (consistent_formats / total_values) * 100
  * Validity (20%): (valid_values / total_values) * 100
  * Balance (10%): (1 - class_imbalance_score) * 100

3. QUALITY DIMENSIONS (0-100 scale)
- COMPLETENESS: Percentage of non-missing values
- UNIQUENESS: For ID columns, percentage of unique values
- CONSISTENCY: Format consistency across columns (dates, phones, emails, case)
- VALIDITY: Percentage of valid values (valid emails, positive salaries, reasonable dates)
- BALANCE: Distribution balance for categorical columns (100 = perfectly balanced)

4. DETAILED ISSUES
For each issue found, provide:

Issue Structure:
{
  "issue_id": "category_columnname_001",
  "severity": "CRITICAL|WARNING|INFO",
  "category": "missing_values|outliers|bias|formatting|duplicates|invalid_data",
  "column": "column_name",
  "title": "Brief title",
  "description": "2-3 sentences describing the issue with specific metrics",
  "recommendation": "Detailed actionable recommendation with specific techniques",
  "metrics": {
    "percentage": <percentage affected>,
    "count": <number of affected rows>,
    "examples": ["example1", "example2"]
  }
}

ISSUE CATEGORIES TO DETECT:

A. MISSING VALUES (INFO severity)
- Calculate missing percentage per column
- Identify which columns have missing data
- Flag if >5% missing in critical columns (ID, Email)
- Recommendation: median/mode imputation or row removal strategy

B. OUTLIERS (WARNING severity)
- For numeric columns: detect values >3 standard deviations from mean
- Calculate outlier percentage
- Identify min/max problematic values
- Calculate IQR-based cap value: Q3 + 1.5 * IQR
- Recommendation: capping, Winsorization, or manual review

C. BIAS/IMBALANCE (CRITICAL severity)
- For categorical columns: calculate bias score using formula:
  bias_score = (dominant_class_frequency / total_rows) * 100 * (100 / expected_uniform_percentage)
- Flag if dominant value represents >30% of entries
- Check for: Name duplicates, Email duplicates, Department imbalance, Date clustering, Phone duplicates, Status imbalance
- Recommendation: oversampling (SMOTE), undersampling, class weighting

D. FORMATTING ERRORS (WARNING severity)
- Emails: check for @@, incomplete domains, missing @
- Phones: check for inconsistent formats, missing hyphens, text in numbers
- Dates: check for multiple formats, invalid dates
- Case inconsistency: mixed case in categorical columns
- Recommendation: standardization rules

E. DUPLICATES (WARNING severity)
- Full row duplicates
- ID column duplicates
- Recommendation: keep first occurrence, remove rest

F. INVALID DATA (CRITICAL severity)
- Negative values in salary
- Dates in future or too far past
- Invalid email formats
- Recommendation: correction or removal

OUTPUT FORMAT (JSON):
{
  "executive_summary": "3-4 sentence summary with specific metrics and impact",
  "core_metrics": {
    "rows": <number>,
    "columns": <number>,
    "size_mb": <number>,
    "overall_score": <0-100>
  },
  "quality_dimensions": {
    "completeness": <0-100>,
    "uniqueness": <0-100>,
    "consistency": <0-100>,
    "validity": <0-100>,
    "balance": <0-100>
  },
  "issues": [
    {
      "issue_id": "missing_values_001",
      "severity": "INFO",
      "category": "missing_values",
      "columns_affected": ["Employee_ID", "Email", "Salary"],
      "title": "Missing Values Detected",
      "description": "Approximately X% of values are missing across Y columns: 'col1', 'col2'. Specific impact on each column.",
      "recommendation": "For 'Salary' (numerical), consider median imputation. For 'Department' (categorical), use mode imputation.",
      "metrics": {
        "total_missing_percentage": 3.75,
        "columns_with_missing": 5,
        "breakdown": {
          "Employee_ID": {"count": 1, "percentage": 5.0},
          "Email": {"count": 2, "percentage": 10.0}
        }
      }
    }
  ],
  "issue_summary": {
    "total_issues": 8,
    "critical": 6,
    "warning": 1,
    "info": 1
  }
}

CRITICAL REQUIREMENTS:
- Calculate all metrics accurately with specific numbers
- Provide actionable, technical recommendations
- Use professional data science terminology (IQR, Winsorization, SMOTE, class weighting)
- Flag CRITICAL issues for bias scores >95, outliers >10%, invalid data
- Flag WARNING for outliers 5-10%, formatting issues
- Flag INFO for missing values <5%
- Return ONLY valid JSON, no other text

Analyze the data now and return the report JSON.
""".strip()


def _configured() -> bool:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return False
    if genai is None:
        return False
    genai.configure(api_key=api_key)
    return True


def generate_quality_report(csv_data: str, *, model_name: str = "gemini-1.5-flash") -> Optional[Dict[str, Any]]:
    """Generate a strict-JSON quality report for PDF rendering, or None if Gemini isn't configured."""

    if not _configured():
        return None

    prompt = DATAFORGE_QUALITY_REPORT_PROMPT.format(csv_data=csv_data)
    model = genai.GenerativeModel(model_name)  # type: ignore[union-attr]
    response = model.generate_content(prompt)

    text = (response.text or "").strip()
    if text.startswith("```json"):
        text = text[len("```json") :]
    if text.startswith("```"):
        text = text[len("```") :]
    if text.endswith("```"):
        text = text[: -len("```")]

    # Be tolerant of accidental prose around the JSON
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]

    parsed = json.loads(text.strip())
    return parsed if isinstance(parsed, dict) else None


_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _looks_like_id_col(col: str) -> bool:
    n = col.lower()
    return n == "id" or n.endswith("_id") or "employee_id" in n or "user_id" in n


def _coerce_series_str(s: pd.Series) -> pd.Series:
    try:
        return s.astype("string")
    except Exception:
        return s.astype(str)


def deterministic_quality_report(
    df: pd.DataFrame,
    *,
    dataset_size_bytes: int | None,
    quality_score: float | None,
    score_breakdown: Dict[str, float] | None,
) -> Dict[str, Any]:
    """Deterministic fallback report in the same schema as the Gemini report."""

    rows = int(len(df))
    cols = int(len(df.columns))
    size_mb = float(dataset_size_bytes / (1024 * 1024)) if dataset_size_bytes is not None else 0.0

    # Completeness
    missing_ratio = float(df.isna().mean().mean()) if rows and cols else 0.0
    completeness = (1.0 - max(0.0, min(1.0, missing_ratio))) * 100

    # Uniqueness (prefer ID-like columns)
    id_cols = [c for c in df.columns if _looks_like_id_col(str(c))]
    uniqueness = 100.0
    if id_cols and rows:
        vals = []
        for c in id_cols:
            s = df[c]
            non_null = int(s.notna().sum())
            if non_null == 0:
                continue
            uniq = int(s.dropna().nunique())
            vals.append(uniq / non_null)
        if vals:
            uniqueness = float(sum(vals) / len(vals)) * 100

    # Consistency: format consistency across common types
    consistency_rates: list[float] = []
    for c in df.columns:
        name = str(c).lower()
        s = df[c]
        non_null = s.dropna()
        if non_null.empty:
            continue

        if any(k in name for k in ["email", "e-mail"]):
            st = _coerce_series_str(non_null).str.strip().str.lower()
            ok = st.apply(lambda v: bool(_EMAIL_RE.match(v)))
            consistency_rates.append(float(ok.mean()))
        elif any(k in name for k in ["phone", "mobile", "tel"]):
            st = _coerce_series_str(non_null).str.strip()
            digits = st.str.replace(r"\D", "", regex=True)
            ok = digits.apply(lambda v: len(v) in (7, 10))
            consistency_rates.append(float(ok.mean()))
        elif any(k in name for k in ["date", "dob", "joined", "created", "timestamp"]):
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                dt = pd.to_datetime(non_null, errors="coerce")
            ok = dt.notna()
            consistency_rates.append(float(ok.mean()))

    consistency = float(sum(consistency_rates) / len(consistency_rates) * 100) if consistency_rates else 100.0

    # Validity: basic value validity (emails/phones/dates + non-negative salary-like numerics)
    validity_rates: list[float] = []
    for c in df.columns:
        name = str(c).lower()
        s = df[c]
        non_null = s.dropna()
        if non_null.empty:
            continue

        if any(k in name for k in ["email", "e-mail"]):
            st = _coerce_series_str(non_null).str.strip().str.lower()
            ok = st.apply(lambda v: bool(_EMAIL_RE.match(v)))
            validity_rates.append(float(ok.mean()))
        elif any(k in name for k in ["phone", "mobile", "tel"]):
            st = _coerce_series_str(non_null).str.strip()
            digits = st.str.replace(r"\D", "", regex=True)
            ok = digits.apply(lambda v: len(v) in (7, 10))
            validity_rates.append(float(ok.mean()))
        elif any(k in name for k in ["date", "dob", "joined", "created", "timestamp"]):
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                dt = pd.to_datetime(non_null, errors="coerce")
            ok = dt.notna() & (dt.dt.year >= 1900) & (dt.dt.year <= 2100)
            validity_rates.append(float(ok.mean()))
        elif any(k in name for k in ["salary", "amount", "price", "cost", "total", "income", "revenue"]):
            num = pd.to_numeric(non_null, errors="coerce")
            ok = num.notna() & (num >= 0)
            validity_rates.append(float(ok.mean()))

    validity = float(sum(validity_rates) / len(validity_rates) * 100) if validity_rates else 100.0

    # Balance: prefer backend score_breakdown imbalance (0-100) if present; else compute a simple proxy
    balance = float(score_breakdown.get("imbalance", 100.0)) if isinstance(score_breakdown, dict) else 100.0

    # Overall score: prompt-weighted average (0-100)
    overall_score = 0.3 * completeness + 0.2 * uniqueness + 0.2 * consistency + 0.2 * validity + 0.1 * balance

    issues: list[dict[str, Any]] = []

    # Missing values issue
    if rows and cols:
        missing_by_col = df.isna().mean().to_dict()
        cols_with_missing = {k: float(v) for k, v in missing_by_col.items() if float(v) > 0}
        if cols_with_missing:
            total_missing_pct = float(missing_ratio * 100)
            sev = "INFO" if total_missing_pct < 5 else "WARNING" if total_missing_pct < 10 else "CRITICAL"
            breakdown: dict[str, Any] = {}
            for k, v in sorted(cols_with_missing.items(), key=lambda kv: kv[1], reverse=True)[:8]:
                breakdown[str(k)] = {
                    "count": int(df[str(k)].isna().sum()) if str(k) in df.columns else 0,
                    "percentage": float(v * 100),
                }
            issues.append(
                {
                    "issue_id": "missing_values_001",
                    "severity": sev,
                    "category": "missing_values",
                    "columns_affected": list(cols_with_missing.keys()),
                    "title": "Missing Values Detected",
                    "description": f"Approximately {total_missing_pct:.2f}% of values are missing across {len(cols_with_missing)} columns. Missingness can bias aggregates and reduce effective sample size for modeling.",
                    "recommendation": "For numerical columns, consider median imputation; for categorical columns, use mode imputation; for ID columns, investigate root causes and consider row removal when uniqueness is required.",
                    "metrics": {
                        "total_missing_percentage": total_missing_pct,
                        "columns_with_missing": len(cols_with_missing),
                        "breakdown": breakdown,
                    },
                }
            )

    # Duplicate rows issue
    if rows:
        dup_ratio = float(df.duplicated().mean())
        if dup_ratio > 0:
            dup_count = int(df.duplicated().sum())
            issues.append(
                {
                    "issue_id": "duplicates_rows_001",
                    "severity": "WARNING",
                    "category": "duplicates",
                    "column": "<row>",
                    "title": "Duplicate Rows Detected",
                    "description": f"Exact duplicate rows were found ({dup_ratio*100:.2f}% of rows, {dup_count} duplicates). Duplicates can inflate dominant patterns and mislead evaluation.",
                    "recommendation": "Keep the first occurrence and remove subsequent duplicates. If duplicates are expected (e.g., event logs), de-duplicate using a stable composite key.",
                    "metrics": {"percentage": float(dup_ratio * 100), "count": dup_count, "examples": []},
                }
            )

    # ID duplicates issue (when ID-like columns exist)
    if rows:
        id_cols = [c for c in df.columns if _looks_like_id_col(str(c))]
        for c in id_cols[:3]:
            s = df[c].dropna()
            if s.empty:
                continue
            dup = s.duplicated().sum()
            if dup <= 0:
                continue
            pct = float(dup / len(s) * 100)
            examples = [str(x) for x in s[s.duplicated()].astype(str).head(3).tolist()]
            issues.append(
                {
                    "issue_id": f"duplicates_{str(c).lower()}_001",
                    "severity": "WARNING" if pct <= 10 else "CRITICAL",
                    "category": "duplicates",
                    "column": str(c),
                    "title": "Duplicate IDs Detected",
                    "description": f"The '{c}' column contains duplicate identifiers ({pct:.2f}% of non-missing entries, {int(dup)} duplicates). This breaks entity integrity and may cause label leakage or aggregation errors.",
                    "recommendation": "Enforce a primary-key constraint for the ID column. Remove or merge duplicates based on a reliable rule (latest timestamp, highest data completeness, or authoritative source).",
                    "metrics": {"percentage": pct, "count": int(dup), "examples": examples},
                }
            )

    # Outliers (numeric columns) — >3 std from mean, include IQR cap
    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    for c in numeric_cols[:8]:
        s = pd.to_numeric(df[c], errors="coerce").dropna()
        if len(s) < 8:
            continue
        mean = float(s.mean())
        std = float(s.std(ddof=0))
        if std <= 0:
            continue
        z = (s - mean).abs() / std
        outliers = s[z > 3]
        outlier_count = int(outliers.shape[0])
        if outlier_count <= 0:
            continue
        outlier_pct = float(outlier_count / len(s) * 100)

        q1 = float(s.quantile(0.25))
        q3 = float(s.quantile(0.75))
        iqr = q3 - q1
        suggested_cap = float(q3 + 1.5 * iqr) if iqr > 0 else float(s.max())

        if outlier_pct < 5:
            continue

        severity = "CRITICAL" if outlier_pct > 10 else "WARNING"
        examples = [str(x) for x in outliers.sort_values(ascending=False).head(3).tolist()]
        issues.append(
            {
                "issue_id": f"outliers_{str(c).lower()}_001",
                "severity": severity,
                "category": "outliers",
                "column": str(c),
                "title": "Numeric Outliers Detected",
                "description": f"The '{c}' column exhibits {outlier_pct:.2f}% outliers using the >3σ rule (mean={mean:.2f}, std={std:.2f}). Outliers can distort scaling, regression loss, and feature importance.",
                "recommendation": f"Investigate extreme entries for data-entry errors. Apply IQR-based capping/Winsorization at {suggested_cap:.2f}, or use robust scalers (median/IQR) if outliers are legitimate.",
                "metrics": {
                    "outlier_percentage": outlier_pct,
                    "outlier_count": outlier_count,
                    "min_value": float(s.min()),
                    "max_value": float(s.max()),
                    "mean": mean,
                    "suggested_cap": suggested_cap,
                    "examples": examples,
                },
            }
        )

    # Bias / imbalance (categorical columns)
    cat_cols = [c for c in df.columns if df[c].dtype == object or pd.api.types.is_string_dtype(df[c])]
    for c in cat_cols[:12]:
        s = _coerce_series_str(df[c]).dropna().str.strip()
        if s.empty:
            continue
        vc = s.value_counts(dropna=True)
        unique = int(vc.shape[0])
        if unique <= 1 or unique > 50:
            continue
        dominant_value = str(vc.index[0])
        dominant_count = int(vc.iloc[0])
        dominant_pct = float(dominant_count / len(s) * 100)
        if dominant_pct <= 30:
            continue
        expected_uniform_pct = 100.0 / unique
        bias_score = dominant_pct * (100.0 / expected_uniform_pct)

        distribution = {str(k): float(v / len(s) * 100) for k, v in vc.head(6).items()}
        severity = "CRITICAL" if bias_score > 95 else "WARNING"
        issues.append(
            {
                "issue_id": f"bias_{str(c).lower()}_001",
                "severity": severity,
                "category": "bias",
                "column": str(c),
                "title": "Category Imbalance Detected",
                "description": f"The '{c}' column is imbalanced with '{dominant_value}' representing {dominant_pct:.2f}% of non-missing entries. Bias score={bias_score:.2f} (expected uniform={expected_uniform_pct:.2f}%). This can skew model learning and fairness metrics.",
                "recommendation": "Assess if the skew reflects real-world prevalence. If not, consider stratified sampling, class weighting, under-sampling the dominant class, or over-sampling minority classes (e.g., SMOTE) for supervised tasks.",
                "metrics": {
                    "bias_score": bias_score,
                    "dominant_value": dominant_value,
                    "dominant_percentage": dominant_pct,
                    "count": dominant_count,
                    "percentage": dominant_pct,
                    "distribution": distribution,
                    "examples": [dominant_value],
                },
            }
        )

    # Formatting errors (emails/phones/dates + case inconsistency)
    for c in df.columns:
        name = str(c).lower()
        s_raw = df[c]
        s = _coerce_series_str(s_raw).dropna().astype(str).str.strip()
        if s.empty:
            continue

        if any(k in name for k in ["email", "e-mail"]):
            st = s.str.lower()
            bad = st[~st.apply(lambda v: bool(_EMAIL_RE.match(v)))]
            if not bad.empty:
                pct = float(len(bad) / len(s) * 100)
                examples = bad.head(3).tolist()
                issues.append(
                    {
                        "issue_id": f"formatting_{str(c).lower()}_001",
                        "severity": "WARNING",
                        "category": "formatting",
                        "column": str(c),
                        "title": "Email Formatting Errors",
                        "description": f"The '{c}' column contains invalid email-like values ({pct:.2f}%, {len(bad)} rows). Common patterns include missing '@' or malformed domains.",
                        "recommendation": "Standardize emails to lowercase, trim whitespace, and validate using a strict regex. For invalid entries, request correction upstream or set to null and impute only if business rules allow.",
                        "metrics": {"percentage": pct, "count": int(len(bad)), "examples": examples},
                    }
                )

        if any(k in name for k in ["phone", "mobile", "tel"]):
            digits = s.str.replace(r"\D", "", regex=True)
            ok = digits.apply(lambda v: len(v) in (7, 10))
            bad = s[~ok]
            if not bad.empty:
                pct = float(len(bad) / len(s) * 100)
                examples = bad.head(3).tolist()
                issues.append(
                    {
                        "issue_id": f"formatting_{str(c).lower()}_002",
                        "severity": "WARNING",
                        "category": "formatting",
                        "column": str(c),
                        "title": "Phone Formatting Inconsistency",
                        "description": f"The '{c}' column shows inconsistent phone formats ({pct:.2f}%, {len(bad)} rows). Values may contain text or non-standard digit counts.",
                        "recommendation": "Normalize to E.164 (country code + digits) or a single canonical format. Strip non-digits, validate digit length, and store the raw original separately if needed for audits.",
                        "metrics": {"percentage": pct, "count": int(len(bad)), "examples": examples},
                    }
                )

        if any(k in name for k in ["date", "dob", "joined", "created", "timestamp"]):
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                dt = pd.to_datetime(s_raw, errors="coerce")
            bad = dt[dt.isna()]
            if bad.shape[0] > 0:
                pct = float(bad.shape[0] / len(s_raw.dropna()) * 100)
                examples = s_raw[dt.isna()].dropna().astype(str).head(3).tolist()
                issues.append(
                    {
                        "issue_id": f"formatting_{str(c).lower()}_003",
                        "severity": "WARNING",
                        "category": "formatting",
                        "column": str(c),
                        "title": "Date Parsing Errors",
                        "description": f"The '{c}' column contains values that cannot be parsed consistently as dates ({pct:.2f}%, {int(bad.shape[0])} rows). Mixed formats reduce reliability in time-based analysis.",
                        "recommendation": "Standardize dates to ISO-8601 (YYYY-MM-DD). Parse with strict rules, reject invalid dates, and log upstream sources causing format drift.",
                        "metrics": {"percentage": pct, "count": int(bad.shape[0]), "examples": examples},
                    }
                )

        # Case inconsistency for low-cardinality categorical columns
        if (df[c].dtype == object or pd.api.types.is_string_dtype(df[c])) and s.nunique() <= 50:
            lower = s.str.lower()
            # If distinct values collapse when lowercased, we have case-variants.
            if lower.nunique() < s.nunique():
                variants = (
                    s.value_counts().head(6).index.tolist()
                    if not s.value_counts().empty
                    else []
                )
                issues.append(
                    {
                        "issue_id": f"formatting_{str(c).lower()}_004",
                        "severity": "WARNING",
                        "category": "formatting",
                        "column": str(c),
                        "title": "Case Inconsistency",
                        "description": f"The '{c}' column contains values that differ only by casing (e.g., 'Sales' vs 'sales'). This can fragment categories and skew frequency-based features.",
                        "recommendation": "Normalize categorical text (trim + consistent casing). Consider mapping through a controlled vocabulary or dictionary encoding to prevent drift.",
                        "metrics": {"percentage": None, "count": None, "examples": [str(v) for v in variants[:3]]},
                    }
                )

    # Invalid data (salary-like negatives; unreasonable dates)
    today = pd.Timestamp.utcnow().normalize()
    for c in df.columns:
        name = str(c).lower()
        if any(k in name for k in ["salary", "amount", "price", "cost", "total", "income", "revenue"]):
            s = pd.to_numeric(df[c], errors="coerce").dropna()
            if s.empty:
                continue
            bad = s[s < 0]
            if not bad.empty:
                pct = float(len(bad) / len(s) * 100)
                examples = [str(x) for x in bad.head(3).tolist()]
                issues.append(
                    {
                        "issue_id": f"invalid_data_{str(c).lower()}_001",
                        "severity": "CRITICAL",
                        "category": "invalid_data",
                        "column": str(c),
                        "title": "Negative Values in Monetary Field",
                        "description": f"The '{c}' column contains negative values ({pct:.2f}%, {len(bad)} rows). This is typically invalid for salaries/amounts and can destabilize model scaling and loss.",
                        "recommendation": "Validate upstream business rules. Correct sign errors where possible; otherwise set to null and impute, or remove affected rows if the field is critical. Add schema constraints to block negatives.",
                        "metrics": {"percentage": pct, "count": int(len(bad)), "examples": examples},
                    }
                )

        if any(k in name for k in ["date", "dob", "joined", "created", "timestamp"]):
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                dt = pd.to_datetime(df[c], errors="coerce")
            good = dt.dropna()
            if good.empty:
                continue
            bad = good[(good.dt.year < 1900) | (good.dt.year > 2100) | (good > (today + pd.Timedelta(days=7)))]
            if not bad.empty:
                pct = float(len(bad) / len(good) * 100)
                examples = df.loc[bad.index, c].dropna().astype(str).head(3).tolist()
                issues.append(
                    {
                        "issue_id": f"invalid_data_{str(c).lower()}_002",
                        "severity": "CRITICAL",
                        "category": "invalid_data",
                        "column": str(c),
                        "title": "Unreasonable Date Values",
                        "description": f"The '{c}' column contains dates outside reasonable bounds or in the future ({pct:.2f}%, {len(bad)} rows). This can break time-split validation and feature derivations.",
                        "recommendation": "Enforce date ranges (e.g., 1900-2100), reject future timestamps unless expected, and standardize parsing to a single format. Consider source-system fixes to prevent invalid dates.",
                        "metrics": {"percentage": pct, "count": int(len(bad)), "examples": examples},
                    }
                )

    issue_summary = {
        "total_issues": len(issues),
        "critical": sum(1 for i in issues if i.get("severity") == "CRITICAL"),
        "warning": sum(1 for i in issues if i.get("severity") == "WARNING"),
        "info": sum(1 for i in issues if i.get("severity") == "INFO"),
    }

    # Executive summary mentioning key issues
    crit = issue_summary["critical"]
    warn = issue_summary["warning"]
    info = issue_summary["info"]
    exec_summary = (
        f"This dataset contains {rows} rows and {cols} columns with an overall quality score of {overall_score:.1f}/100 (weighted across completeness, uniqueness, consistency, validity, and balance). "
        f"Quality dimensions score: completeness {completeness:.0f}, uniqueness {uniqueness:.0f}, consistency {consistency:.0f}, validity {validity:.0f}, balance {balance:.0f}. "
        f"Detected {crit} CRITICAL, {warn} WARNING, and {info} INFO issues, including missingness, imbalance, and potential integrity/formatting problems. "
        "These issues can cause biased learning, unstable features, and reduced model reliability unless cleaned and validated."
    )

    return {
        "executive_summary": exec_summary,
        "core_metrics": {"rows": rows, "columns": cols, "size_mb": round(size_mb, 2), "overall_score": round(overall_score, 1)},
        "quality_dimensions": {
            "completeness": round(completeness, 1),
            "uniqueness": round(uniqueness, 1),
            "consistency": round(consistency, 1),
            "validity": round(validity, 1),
            "balance": round(balance, 1),
        },
        "issues": issues,
        "issue_summary": issue_summary,
        "generated_by": "deterministic",
        "generated_on": date.today().isoformat(),
    }
