from __future__ import annotations

import json
import os
from typing import Any, Dict, List
try:
    import google.generativeai as genai  # type: ignore[import-not-found]
except Exception:  # pragma: no cover
    genai = None  # type: ignore


def _gemini_is_configured() -> bool:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return False
    if genai is None:
        return False
    # Configure at call time so key swaps don't depend on module import order.
    genai.configure(api_key=api_key)
    return True

def _severity_bucket(score: float) -> str:
    if score >= 85:
        return "Low risk"
    if score >= 65:
        return "Moderate risk"
    return "High risk"

def generate_grounded_report(result: Dict[str, Any]) -> Dict[str, Any]:
    quality = float(result.get("quality_score", 0))
    dimensions: List[Dict[str, Any]] = result.get("dimensions", [])
    weakest = sorted(dimensions, key=lambda x: x.get("score", 100))[:2]
    weak_names = [w.get("name", "unknown") for w in weakest]
    
    pii_leaks = result.get("pii_leaks", {})
    pii_info = ""
    if pii_leaks:
        pii_info = f"Critical Risk: PII leaks detected in {len(pii_leaks)} columns. "

    deployment_readiness = "Fail" if pii_leaks else ("Pass" if quality >= 80 else "Conditional Pass" if quality >= 60 else "Fail")

    # If no API key is configured, avoid external calls and use deterministic output.
    if not _gemini_is_configured():
        summary = (
            f"Dataset quality score is {quality:.2f}/100 ({_severity_bucket(quality)}). "
            f"Highest risk areas: {', '.join(weak_names) if weak_names else 'none'}."
        )

        actions = [
            {"priority": 1, "action": "Fix missing and noisy columns with highest null/outlier rates.", "effort": "medium"},
            {"priority": 2, "action": "Mitigate bias in sensitive groups by stratified sampling or reweighting.", "effort": "high"},
            {"priority": 3, "action": "Remove exact duplicates and inspect near-duplicate clusters.", "effort": "low"},
        ]
        return {
            "executive_summary": summary,
            "deployment_readiness": deployment_readiness,
            "top_actions": actions,
            "confidence": "medium",
            "powered_by": "deterministic",
        }

    try:
        model_name = "gemini-1.5-flash"
        model = genai.GenerativeModel(model_name)
        prompt = f"""
You are an expert Data Scientist and AI auditor. Analyze the following dataset quality results and provide a brief remediation report.

Dataset Quality Score: {quality:.2f}/100 ({_severity_bucket(quality)})
Deployment Readiness: {deployment_readiness}
Top Vulnerabilities/Risk Areas: {', '.join(weak_names) if weak_names else 'none'}
PII Information: {pii_info}
Detailed Dimensions: {json.dumps(dimensions)}

Respond strictly in valid JSON format matching this schema:
{{
  "executive_summary": "A concise summary of the dataset's quality and primary issues (1-2 sentences)",
  "deployment_readiness": "{deployment_readiness}",
  "top_actions": [
    {{"priority": 1, "action": "Specific technical action", "effort": "low/medium/high"}}
  ],
  "confidence": "high/medium/low based on the clarity of the result data"
}}
"""
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        
        parsed = json.loads(text.strip())
        return {
            "executive_summary": parsed.get("executive_summary", "Summary unavailable."),
            "deployment_readiness": deployment_readiness,
            "top_actions": parsed.get("top_actions", []),
            "confidence": parsed.get("confidence", "low"),
            "powered_by": model_name,
        }
    except Exception as e:
        # Fallback to deterministic generation if API fails
        summary = (
            f"Dataset quality score is {quality:.2f}/100 ({_severity_bucket(quality)}). "
            f"Highest risk areas: {', '.join(weak_names) if weak_names else 'none'}."
        )

        actions = [
            {"priority": 1, "action": "Fix missing and noisy columns with highest null/outlier rates.", "effort": "medium"},
            {"priority": 2, "action": "Mitigate bias in sensitive groups by stratified sampling or reweighting.", "effort": "high"},
            {"priority": 3, "action": "Remove exact duplicates and inspect near duplicates before training.", "effort": "low"},
        ]
        return {
            "executive_summary": summary,
            "deployment_readiness": deployment_readiness,
            "top_actions": actions,
            "confidence": "medium",
            "powered_by": "deterministic",
        }
