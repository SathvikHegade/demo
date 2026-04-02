"""
generate_demo.py — Creates demo_dirty.csv with intentional data quality problems.
Run: python sample_data/generate_demo.py
"""
import numpy as np
import pandas as pd
import random
import string

rng = np.random.default_rng(42)
random.seed(42)
N = 500

# ── age: 15% missing, 5 extreme outliers ─────────────────────────────────────
age = rng.integers(18, 70, size=N).astype(float)
missing_idx = rng.choice(N, size=int(N * 0.15), replace=False)
age[missing_idx] = np.nan
outlier_idx = rng.choice(N, size=5, replace=False)
age[outlier_idx] = rng.integers(210, 350, size=5)

# ── gender: 80% male, 20% female ─────────────────────────────────────────────
gender = rng.choice(["male", "female"], size=N, p=[0.80, 0.20])

# ── income: right-skewed, some as "$45,000" strings ──────────────────────────
income_num = np.abs(rng.lognormal(mean=10.5, sigma=0.8, size=N))
income_num = np.round(income_num, -2)
income = income_num.astype(str)
# 40 rows with dollar-sign format
dollar_idx = rng.choice(N, size=40, replace=False)
for i in dollar_idx:
    income[i] = f"${int(income_num[i]):,}"

# ── category: mixed spellings of the same value ───────────────────────────────
cat_variants = [
    "USA", "U.S.A", "United States", "us", "US", "united states", "U.S.",
    "Canada", "canada", "CAN",
    "UK", "United Kingdom", "u.k.", "Britain",
]
category = rng.choice(cat_variants, size=N,
                       p=[0.30, 0.10, 0.10, 0.05, 0.05, 0.05, 0.05,
                          0.08, 0.04, 0.03, 0.06, 0.04, 0.03, 0.02])

# ── score: 90% class 0, 10% class 1 (severe imbalance) ───────────────────────
score = rng.choice([0, 1], size=N, p=[0.90, 0.10])

# ── id: 30 exact duplicate rows ───────────────────────────────────────────────
base_ids = list(range(1, N - 30 + 1))
dup_ids = random.choices(base_ids[:100], k=30)
ids = base_ids + dup_ids
random.shuffle(ids)
row_id = ids[:N]

# ── email: 5 rows with real PII pattern, rest blank ───────────────────────────
email = [""] * N
pii_idx = rng.choice(N, size=5, replace=False)
domains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "proton.me"]
for i in pii_idx:
    username = "".join(random.choices(string.ascii_lowercase, k=7))
    email[i] = f"{username}@{random.choice(domains)}"

# ── notes: mixed languages ────────────────────────────────────────────────────
en_notes = [
    "Customer requested a refund", "Good standing account", "Needs follow-up",
    "VIP customer", "Flagged for review", "New registration", "Account closed",
]
es_notes = [
    "El cliente solicitó un reembolso", "Cuenta en buen estado",
    "Necesita seguimiento", "Cliente VIP",
]
fr_notes = [
    "Le client a demandé un remboursement", "Bon état du compte",
    "Nouveau compte", "Compte fermé",
]
all_notes = en_notes + es_notes + fr_notes
notes = [random.choice(all_notes) for _ in range(N)]

# ── Assemble DataFrame ────────────────────────────────────────────────────────
df = pd.DataFrame({
    "id": row_id,
    "age": age,
    "gender": gender,
    "income": income,
    "category": category,
    "score": score,
    "email": email,
    "notes": notes,
})

# Duplicate 30 rows exactly (rows at indices 450-479)
dup_rows = df.sample(30, random_state=42)
df = pd.concat([df, dup_rows], ignore_index=True).sample(frac=1, random_state=42).reset_index(drop=True)
df = df.head(500)  # keep exactly 500

out_path = "sample_data/demo_dirty.csv"
df.to_csv(out_path, index=False)
print(f"✅ Saved {len(df)} rows to {out_path}")
print(f"   Age missing:    {df['age'].isna().sum()} ({df['age'].isna().mean():.0%})")
print(f"   Gender 80/20:   {df['gender'].value_counts().to_dict()}")
print(f"   Score imbal:    {df['score'].value_counts().to_dict()}")
print(f"   Exact dupes:    {df.duplicated().sum()}")
print(f"   PII emails:     {(df['email'] != '').sum()}")
