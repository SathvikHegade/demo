from __future__ import annotations

import json
import os
import re
import warnings
from typing import Any, Dict, Optional

import pandas as pd

try:
    import google.generativeai as genai  # type: ignore[import-not-found]
except Exception:  # pragma: no cover
    genai = None  # type: ignore


GEMINI_DATA_CLEANING_PROMPT = """
You are an expert data cleaning assistant. Analyze the provided CSV data and identify all data quality issues.

INPUT DATA:
{csv_data}

TASK:
1. Analyze each column and identify data quality issues
2. Categorize issues into types: missing values, duplicates, format inconsistencies, invalid data, outliers
3. Suggest specific fixes for each issue
4. Provide a confidence score (0-100) for each suggested fix

OUTPUT FORMAT (strict JSON):
{{
  \"summary\": {{
    \"total_rows\": <number>,
    \"total_columns\": <number>,
    \"issues_found\": <number>,
    \"data_quality_score\": <0-100>
  }},
  \"issues\": [
    {{
      \"issue_id\": \"1\",
      \"row_number\": <row_number or \"multiple\">,
      \"column\": \"<column_name>\",
      \"issue_type\": \"missing_value|duplicate|format_inconsistency|invalid_data|outlier|data_type_mismatch\",
      \"severity\": \"high|medium|low\",
      \"current_value\": \"<current_value>\",
      \"description\": \"<clear description of the issue>\",
      \"suggested_fix\": \"<specific fix to apply>\",
      \"fix_action\": \"replace|remove|standardize|validate|flag\",
      \"confidence\": <0-100>,
      \"reasoning\": \"<why this fix is suggested>\"
    }}
  ],
  \"column_analysis\": {{
    \"<column_name>\": {{
      \"data_type\": \"string|number|date|email|phone|categorical\",
      \"completeness\": <percentage>,
      \"unique_values\": <count>,
      \"issues_count\": <count>,
      \"suggested_format\": \"<format if applicable>\"
    }}
  }},
  \"recommendations\": [
    \"<general recommendation 1>\",
    \"<general recommendation 2>\"
  ]
}}

SPECIFIC CHECKS TO PERFORM:
- Email: Valid format (name@domain.com), no double @@, complete domain
- Phone: Consistent format (XXX-XXXX or similar)
- Dates: Standardize to YYYY-MM-DD, flag invalid dates
- Duplicates: Check Employee_ID and full row duplicates
- Missing values: Identify and suggest appropriate handling
- Outliers: Detect unrealistic salaries, dates (too old/future)
- Text: Trim whitespace, standardize case if needed
- Data types: Ensure numeric fields don't have text

IMPORTANT:
- Do NOT fabricate data
- For missing values, suggest \"flag as missing\" or \"remove row\" rather than inventing values
- Be specific about the fix (e.g., \"Change from DD/MM/YYYY to YYYY-MM-DD\")
- Prioritize high-severity issues
- Return ONLY valid JSON, no additional text
""".strip()


GEMINI_CLEANING_PLAN_PROMPT = """
ROLE: You are an AI data cleaning engine.

INPUT CSV (sample):
{csv_data}

TASK:
- Infer column types.
- Propose a safe cleaning plan that does NOT fabricate values.

OUTPUT (STRICT JSON ONLY):
{
    "column_types": {
        "<column_name>": "id|email|phone|date|numeric|categorical|text|boolean"
    },
    "critical_columns": ["<column_name>", "<column_name>"] ,
    "row_rules": {
        "drop_if_missing": ["<column_name>"],
        "drop_duplicates_on": ["<column_name>"]
    },
    "notes": ["<short note>"]
}

RULES:
- Never invent realistic-looking data.
- If a value is invalid and cannot be safely fixed, set it to null (missing).
- Prefer: trim whitespace, normalize missing markers, lowercase emails, format phone digits, ISO dates, strip currency symbols.
- For IDs: must be unique; drop duplicates (keep first) and drop rows with missing ID.
- Return ONLY JSON.
""".strip()


def _infer_col_type(col_name: str, series: pd.Series) -> str:
    name = col_name.lower()

    if any(k in name for k in ["email", "e-mail"]):
        return "email"
    if any(k in name for k in ["phone", "mobile", "tel"]):
        return "phone"
    if any(k in name for k in ["date", "dob", "joined", "created", "timestamp"]):
        return "date"
    if any(
        k in name
        for k in [
            "salary",
            "amount",
            "price",
            "cost",
            "total",
            "revenue",
            "income",
            "qty",
            "quantity",
        ]
    ):
        return "numeric"
    if name.endswith("_id") or name == "id" or "employee_id" in name:
        return "id"

    sample = series.dropna().astype(str).head(50).tolist()
    sample = [s.strip() for s in sample if s.strip()]
    if not sample:
        return "text"

    # Heuristics on values
    if sum(1 for s in sample if "@" in s) >= max(1, len(sample) // 4):
        return "email"

    digits_only_ratio = (
        sum(1 for s in sample if re.sub(r"\D", "", s) and len(re.sub(r"\D", "", s)) in (7, 10))
        / len(sample)
    )
    if digits_only_ratio >= 0.6:
        return "phone"

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        dt = pd.to_datetime(pd.Series(sample), errors="coerce")
    if dt.notna().mean() >= 0.7:
        return "date"

    # Numeric-ish?
    num = pd.to_numeric(pd.Series([re.sub(r"[,$€£\s]", "", s) for s in sample]), errors="coerce")
    if num.notna().mean() >= 0.6:
        return "numeric"

    nunique = series.nunique(dropna=True)
    if nunique <= max(20, int(len(series) * 0.1)):
        return "categorical"
    return "text"


def generate_deterministic_cleaning_plan(df: pd.DataFrame) -> Dict[str, Any]:
    """Generate a safe, deterministic cleaning plan from the dataframe itself.

    This is used as a fallback when Gemini isn't configured but the caller
    requested cleaning.
    """

    column_types: Dict[str, str] = {}
    for col in df.columns:
        column_types[str(col)] = _infer_col_type(str(col), df[col])

    id_cols = [c for c, t in column_types.items() if t == "id" and c in df.columns]
    row_rules: Dict[str, Any] = {"drop_if_missing": [], "drop_duplicates_on": []}
    critical_columns: list[str] = []
    if id_cols:
        critical_columns = [id_cols[0]]
        row_rules["drop_if_missing"] = [id_cols[0]]
        row_rules["drop_duplicates_on"] = [id_cols[0]]

    return {
        "column_types": column_types,
        "critical_columns": critical_columns,
        "row_rules": row_rules,
        "notes": ["Generated deterministically (Gemini not configured)."],
    }


def _configured() -> bool:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return False
    if genai is None:
        return False

    # Configure once per process. Re-configuring is safe but unnecessary.
    genai.configure(api_key=api_key)
    return True


def generate_cleaning_analysis(csv_data: str, *, model_name: str = "gemini-1.5-flash") -> Optional[Dict[str, Any]]:
    """Return structured cleaning analysis JSON, or None if Gemini isn't configured.

    This is intentionally optional to keep local demos working without secrets.
    """

    if not _configured():
        return None

    prompt = GEMINI_DATA_CLEANING_PROMPT.format(csv_data=csv_data)
    model = genai.GenerativeModel(model_name)  # type: ignore[union-attr]
    response = model.generate_content(prompt)

    text = (response.text or "").strip()
    if text.startswith("```json"):
        text = text[len("```json") :]
    if text.startswith("```"):
        text = text[len("```") :]
    if text.endswith("```"):
        text = text[: -len("```")]

    return json.loads(text.strip())


def generate_cleaning_plan(csv_data: str, *, model_name: str = "gemini-1.5-flash") -> Optional[Dict[str, Any]]:
    """Return a strict-JSON cleaning plan, or None if Gemini isn't configured."""

    if not _configured():
        return None

    prompt = GEMINI_CLEANING_PLAN_PROMPT.format(csv_data=csv_data)
    model = genai.GenerativeModel(model_name)  # type: ignore[union-attr]
    response = model.generate_content(prompt)

    text = (response.text or "").strip()
    if text.startswith("```json"):
        text = text[len("```json") :]
    if text.startswith("```"):
        text = text[len("```") :]
    if text.endswith("```"):
        text = text[: -len("```")]

    parsed = json.loads(text.strip())
    if not isinstance(parsed, dict):
        return None
    return parsed


def apply_cleaning_analysis(df: pd.DataFrame, cleaning_analysis: Optional[Dict[str, Any]]) -> pd.DataFrame:
    """Apply a conservative set of cleaning steps.

    Goals:
    - Never fabricate values.
    - Keep behavior deterministic.
    - Optionally drop explicitly identified bad rows from Gemini output.

    Current operations:
    - Trim whitespace on string-like columns (preserves NaN).
    - Drop exact duplicate rows.
    - Drop specific 1-based row numbers when Gemini suggests `fix_action: remove`.
    """

    cleaned = df.copy()

    missing_markers = {"", "null", "none", "na", "n/a", "nan", "-", "--"}

    def _normalize_missing(text: str) -> Optional[str]:
        t = text.strip()
        if t.lower() in missing_markers:
            return None
        return t

    email_re = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

    def _clean_email(value: Any) -> Any:
        if pd.isna(value):
            return pd.NA
        t = _normalize_missing(str(value))
        if t is None:
            return pd.NA
        t = t.replace("@@", "@").replace(" ", "").lower()
        return t if email_re.match(t) else pd.NA

    def _clean_phone(value: Any) -> Any:
        if pd.isna(value):
            return pd.NA
        t = _normalize_missing(str(value))
        if t is None:
            return pd.NA
        digits = re.sub(r"\D", "", t)
        if len(digits) == 10:
            return f"{digits[0:3]}-{digits[3:6]}-{digits[6:10]}"
        if len(digits) == 7:
            return f"{digits[0:3]}-{digits[3:7]}"
        return pd.NA

    def _clean_date(value: Any) -> Any:
        if pd.isna(value):
            return pd.NA
        t = _normalize_missing(str(value))
        if t is None:
            return pd.NA
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            dt = pd.to_datetime(t, errors="coerce")
        if pd.isna(dt):
            return pd.NA
        year = int(dt.year)
        if year < 1900 or year > 2100:
            return pd.NA
        return dt.strftime("%Y-%m-%d")

    def _clean_numeric(series: pd.Series) -> pd.Series:
        as_str = series.astype(str)
        as_str = as_str.where(~series.isna(), pd.NA)
        cleaned_str = as_str.apply(lambda v: pd.NA if v is pd.NA else (_normalize_missing(str(v)) or ""))
        cleaned_str = cleaned_str.replace("", pd.NA)
        cleaned_str = cleaned_str.astype("string").str.replace(r"[,$€£\s]", "", regex=True)
        return pd.to_numeric(cleaned_str, errors="coerce")

    def _clean_id(value: Any) -> Any:
        if pd.isna(value):
            return pd.NA
        t = _normalize_missing(str(value))
        if t is None:
            return pd.NA
        # Normalize values like "123.0" -> "123" when whole.
        try:
            f = float(t)
            if f.is_integer():
                return str(int(f))
        except Exception:
            pass
        return t.strip()

    def _clean_text(value: Any) -> Any:
        if pd.isna(value):
            return pd.NA
        t = _normalize_missing(str(value))
        if t is None:
            return pd.NA
        # Remove common control chars, then trim.
        t = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F]", "", t)
        return t.strip()

    # Column-wise deterministic cleaning.
    inferred_types: dict[str, str] = {}
    for col in cleaned.columns:
        inferred_types[col] = _infer_col_type(col, cleaned[col])

    # Optional: use Gemini-proposed column types + row rules if present.
    cleaning_plan: Optional[Dict[str, Any]] = None
    if cleaning_analysis and isinstance(cleaning_analysis, dict):
        # If the caller passed a combined object, allow nesting.
        maybe_plan = cleaning_analysis.get("cleaning_plan")
        if isinstance(maybe_plan, dict):
            cleaning_plan = maybe_plan

    if cleaning_plan and isinstance(cleaning_plan.get("column_types"), dict):
        for col, t in cleaning_plan["column_types"].items():
            if col in inferred_types and isinstance(t, str):
                inferred_types[col] = t

    for col, col_type in inferred_types.items():
        if col_type == "email":
            cleaned[col] = cleaned[col].apply(_clean_email)
        elif col_type == "phone":
            cleaned[col] = cleaned[col].apply(_clean_phone)
        elif col_type == "date":
            cleaned[col] = cleaned[col].apply(_clean_date)
        elif col_type == "numeric":
            cleaned[col] = _clean_numeric(cleaned[col])
        elif col_type == "id":
            cleaned[col] = cleaned[col].apply(_clean_id)
        else:
            # categorical/text/boolean fall back to safe trimming
            if cleaned[col].dtype == object:
                cleaned[col] = cleaned[col].apply(_clean_text)

    # Drop rows missing critical ID columns (if any were detected).
    id_cols = [c for c, t in inferred_types.items() if t == "id"]
    if id_cols:
        cleaned = cleaned.dropna(subset=id_cols)

        # Ensure uniqueness for ID columns: drop duplicate IDs, keep first.
        # If multiple ID-like columns exist, use the first as primary key.
        primary_id = id_cols[0]
        cleaned = cleaned.drop_duplicates(subset=[primary_id], keep="first")

    # Apply Gemini row_rules if provided.
    if cleaning_plan and isinstance(cleaning_plan.get("row_rules"), dict):
        row_rules = cleaning_plan["row_rules"]
        drop_if_missing = row_rules.get("drop_if_missing")
        if isinstance(drop_if_missing, list):
            cols = [c for c in drop_if_missing if isinstance(c, str) and c in cleaned.columns]
            if cols:
                cleaned = cleaned.dropna(subset=cols)

        drop_duplicates_on = row_rules.get("drop_duplicates_on")
        if isinstance(drop_duplicates_on, list):
            cols = [c for c in drop_duplicates_on if isinstance(c, str) and c in cleaned.columns]
            if cols:
                cleaned = cleaned.drop_duplicates(subset=cols, keep="first")

    # Remove exact duplicate rows.
    cleaned = cleaned.drop_duplicates()

    # Apply row removals if Gemini provided explicit rows.
    if cleaning_analysis and isinstance(cleaning_analysis, dict):
        rows_to_drop: set[int] = set()
        for issue in cleaning_analysis.get("issues", []) or []:
            if not isinstance(issue, dict):
                continue
            action = issue.get("fix_action")
            row_number = issue.get("row_number")

            if action == "remove" and isinstance(row_number, int) and row_number > 0:
                # Gemini is expected to use 1-based row numbers.
                rows_to_drop.add(row_number - 1)
            elif issue.get("issue_type") == "duplicate" and isinstance(row_number, int) and row_number > 0:
                rows_to_drop.add(row_number - 1)

        if rows_to_drop:
            index_to_drop = [idx for idx in rows_to_drop if 0 <= idx < len(cleaned)]
            if index_to_drop:
                cleaned = cleaned.drop(cleaned.index[index_to_drop])

    return cleaned
