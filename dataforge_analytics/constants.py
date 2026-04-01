import numpy as np

# SENTINELS AND PLACEHOLDERS FOR NOISE DETECTION
SENTINEL_VALUES = {
    "N/A", "n/a", "NA", "na", "null", "NULL", "none", "NONE", 
    "?", "-", "--", "9999", "-1", "-99", "-999", "-9999", "missing", "unknown"
}

# THRESHOLDS
IQR_MULTIPLIER = 1.5
Z_SCORE_THRESHOLD = 3.0
FUZZY_MATCH_THRESHOLD = 85.0
LOW_VARIANCE_THRESHOLD = 0.95
CORRELATION_THRESHOLD = 0.98

# IMBALANCE CATEGORIES
IMBALANCE_CATEGORIES = {
    "BALANCED": (0.0, 1.5),
    "MILD": (1.5, 3.0),
    "MODERATE": (3.0, 10.0),
    "SEVERE": (10.0, 100.0),
    "EXTREME": (100.0, float('inf'))
}
