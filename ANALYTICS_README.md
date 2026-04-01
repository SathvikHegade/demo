# DataForge Analytics

DataForge Analytics is the core machine learning and statistics engine for evaluating dataset quality across four dimensions:
1. **Bias (Outliers)**
2. **Noise (Data Types, Structures, Values)**
3. **Duplication**
4. **Class Imbalance**

## Features & Innovations

- **DataForge Drift Vulnerability Score**: Estimates model performance degradation risk if a dataset shifts distribution, leveraging Kurtosis & Entropy.
- **Robust Algorithms**: Isolation Forest, IQR methods, MinHash LSH, and Shannon Entropy formulas implemented safely via Scipy/Numpy vectorized structures.

## Installation
```
pip install -r requirements.txt
```

## Running Tests
```
pytest dataforge_analytics/tests/
```
