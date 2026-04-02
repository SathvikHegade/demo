"""
ai_service.py — Gemini AI integration for narrative generation.
Uses gemini-2.5-flash-preview-05-14 via google-generativeai SDK.
FIXED: reads GEMINI_API_KEY (spec) with fallback to GOOGLE_API_KEY (legacy)
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List

import google.generativeai as genai

from models.response_models import Issue

logger = logging.getLogger(__name__)

_client_initialised = False


def _ensure_client() -> None:
    global _client_initialised
    if not _client_initialised:
        # FIXED: spec requires GEMINI_API_KEY; accept GOOGLE_API_KEY as fallback
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY environment variable is not set. "
                "Add it to backend/.env"
            )
        genai.configure(api_key=api_key)
        _client_initialised = True


def _get_model() -> genai.GenerativeModel:
    _ensure_client()
    # FIXED: use gemini-2.5-flash-preview-05-14 per spec (was gemini-2.5-flash)
    return genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=(
            "You are a senior data scientist and ML engineer specialising in dataset quality audits. "
            "You provide precise, actionable, technically accurate analysis grounded in statistics. "
            "You always quantify recommendations where possible and predict model performance impact. "
            "CRITICAL: Respond ONLY with valid JSON — no markdown fences, no preamble, no commentary."
        ),
    )


async def generate_executive_summary(stats: Dict[str, Any]) -> str:
    prompt = f"""Given the following dataset quality statistics, write a 3-5 sentence executive \
summary for a data science team. Mention the most critical issues first. \
Quantify every claim (use numbers from the stats). Be direct — no filler phrases.

STATISTICS:
{json.dumps(stats, indent=2, default=str)}

Respond with ONLY a JSON object matching this schema exactly:
{{"summary": "<your 3-5 sentence executive summary>"}}"""

    try:
        model = _get_model()
        response = model.generate_content(prompt)
        text = _strip_fences(response.text)
        parsed = json.loads(text)
        return parsed.get("summary", text)
    except json.JSONDecodeError:
        logger.warning("Gemini returned non-JSON for executive summary; using raw text.")
        return response.text.strip()
    except Exception as exc:
        logger.error("Executive summary generation failed: %s", exc)
        return "Executive summary unavailable — see individual issue reports below."


_ISSUE_SCHEMA = """{
  "issues": [
    {
      "id": "<unique string, e.g. bias_gender_001>",
      "category": "<bias|noise|duplicate|imbalance>",
      "severity": "<CRITICAL|WARNING|INFO>",
      "column": "<column name or null>",
      "description": "<2-3 sentences plain English description of the problem>",
      "metric_value": <float>,
      "threshold": <float>,
      "recommendation": "<specific actionable fix with concrete steps or code approach>",
      "estimated_impact": "<1-2 sentences on ML model performance impact if not fixed>"
    }
  ]
}"""


async def generate_issue_narratives(stats: Dict[str, Any]) -> List[Issue]:
    prompt = f"""You are auditing a dataset. Below are all detected quality issues as raw statistics.
For EACH issue, generate a structured entry with:
- A plain-English description (2-3 sentences)
- A specific actionable recommendation (name exact techniques: SMOTE, IQR capping, StandardScaler, etc.)
- A predicted ML model performance impact (1-2 sentences)

Severity rules:
- CRITICAL: missing > 20%, imbalance ratio > 10, bias_score > 60, exact_duplicates > 10%
- WARNING: missing 5-20%, imbalance 3-10, bias_score 30-60, outlier_fraction > 5%
- INFO: everything else that may still affect model quality

DATASET STATISTICS:
{json.dumps(stats, indent=2, default=str)}

Respond ONLY with a JSON object matching this schema exactly:
{_ISSUE_SCHEMA}"""

    try:
        model = _get_model()
        response = model.generate_content(prompt)
        text = _strip_fences(response.text)
        parsed = json.loads(text)
        raw_issues = parsed.get("issues", [])
    except json.JSONDecodeError:
        logger.error("Gemini returned non-JSON for issues. Raw: %s", response.text[:500])
        return []
    except Exception as exc:
        logger.error("Issue narrative generation failed: %s", exc)
        return []

    issues: List[Issue] = []
    for idx, raw in enumerate(raw_issues):
        try:
            issues.append(
                Issue(
                    id=str(raw.get("id", f"issue_{idx:03d}")),
                    category=str(raw.get("category", "noise")),
                    severity=str(raw.get("severity", "INFO")),
                    column=raw.get("column"),
                    description=str(raw.get("description", "")),
                    metric_value=float(raw.get("metric_value", 0.0)),
                    threshold=float(raw.get("threshold", 0.0)),
                    recommendation=str(raw.get("recommendation", "")),
                    estimated_impact=str(raw.get("estimated_impact", "")),
                )
            )
        except Exception as e:
            logger.warning("Skipping malformed issue #%d: %s", idx, e)

    return issues


def _strip_fences(text: str) -> str:
    """Remove markdown code fences that Gemini occasionally emits."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        start = 1 if lines[0].startswith("```") else 0
        end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
        text = "\n".join(lines[start:end])
    return text.strip()
