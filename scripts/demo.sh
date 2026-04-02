#!/bin/bash
# Demo Script for DataForge Presentation

echo "🧪 Downloading 'titanic' dataset from seaborn/sklearn..."
python3 -c "
import seaborn as sns
df = sns.load_dataset('titanic')
df.to_csv('sample_data/titanic_raw.csv', index=False)
"

echo "💉 Injecting artificial noise (duplicates, missing values)..."
python3 -c "
import pandas as pd
import numpy as np

df = pd.read_csv('sample_data/titanic_raw.csv')

# Duplicate 5%
dupes = df.sample(frac=0.05)
df = pd.concat([df, dupes])

# Missing values 15%
mask = np.random.rand(*df.shape) < 0.15
df[mask] = np.nan

df.to_csv('sample_data/titanic_dirty.csv', index=False)
"
echo "✅ sample_data/titanic_dirty.csv generated for demo!"

echo ""
echo "🚀 Running DataForge CLI on the dirty dataset..."
dataforge analyze sample_data/titanic_dirty.csv --target-col survived --threshold 0.70

echo ""
echo "🌐 Starting full development stack for UI demo..."
make dev
