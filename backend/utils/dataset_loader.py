"""
dataset_loader.py — async-safe CSV / JSON / Excel ingestion with size guard.
"""
from __future__ import annotations

import io
import os
from pathlib import Path
from typing import Tuple

import aiofiles
import pandas as pd


MAX_FILE_SIZE_MB: float = float(os.getenv("MAX_FILE_SIZE_MB", "50"))


async def load_dataset(file_path: str) -> Tuple[pd.DataFrame, float]:
    """
    Load a dataset from disk into a pandas DataFrame.

    Supports CSV, JSON (records/lines), and Excel (.xlsx / .xls).

    Parameters
    ----------
    file_path : str
        Absolute path to the uploaded file.

    Returns
    -------
    df : pd.DataFrame
        Parsed dataset.
    size_mb : float
        File size in megabytes.

    Raises
    ------
    ValueError
        If the file exceeds MAX_FILE_SIZE_MB or the format is unsupported.
    """
    path = Path(file_path)
    size_bytes = path.stat().st_size
    size_mb = size_bytes / (1024 ** 2)

    if size_mb > MAX_FILE_SIZE_MB:
        raise ValueError(
            f"File size {size_mb:.1f} MB exceeds the {MAX_FILE_SIZE_MB} MB limit."
        )

    suffix = path.suffix.lower()

    async with aiofiles.open(file_path, "rb") as fh:
        raw = await fh.read()

    buf = io.BytesIO(raw)

    if suffix == ".csv":
        df = pd.read_csv(buf, low_memory=False)
    elif suffix == ".json":
        try:
            df = pd.read_json(buf, orient="records")
        except Exception:
            buf.seek(0)
            df = pd.read_json(buf, lines=True)
    elif suffix in (".xlsx", ".xls"):
        df = pd.read_excel(buf, engine="openpyxl")
    else:
        raise ValueError(
            f"Unsupported file format '{suffix}'. Accepted: .csv, .json, .xlsx, .xls"
        )

    return df, size_mb
