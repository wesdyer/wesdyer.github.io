# AI Stat Calibration Analysis

## Methodology

1.  **Data Collection**: Ran 8 trials of the full regatta simulation (approx. 80 boat-races).
2.  **Regression**: Performed a Multiple Linear Regression of Race Time vs. Stat Values (`acceleration`, `momentum`, `handling`, `upwind`, `reach`, `downwind`, `boost`).

## Results

**Intercept (Base Time):** 295.04s

**Coefficients (Effect on Time per Stat Point):**
*   **acceleration:** +0.55 s (Positive/Harmful - Likely noise/collinearity)
*   **momentum:** +1.30 s (Positive/Harmful - Likely noise/collinearity)
*   **handling:** -0.03 s (Negligible)
*   **upwind:** -0.61 s (Beneficial)
*   **reach:** -0.09 s (Negligible)
*   **downwind:** +1.47 s (Positive/Harmful - Likely noise/collinearity)
*   **boost:** -1.92 s (Strongly Beneficial)

## Interpretation

*   **Multicollinearity**: The character stats are designed to be balanced (sum of weighted stats $\approx$ 0). This creates strong correlations between stats (e.g., high Upwind often implies low Downwind), which confuses the regression coefficients (flipping signs).
*   **Power Imbalance**: Despite the noise, `boost` (-1.92s) was significantly more impactful than `upwind` (-0.61s). `handling` appeared negligible.

## Recalibration Strategy

To equalize the impact of stats, we aimed for a target effect of approximately **-1.5s to -2.0s per point** (matching the observed power of `boost` and `upwind` theoreticals).

**Multiplier Adjustments:**

| Stat | Old Multiplier | Old % | Effect Obs. | New Multiplier | New % | Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Acceleration** | 0.024 | 2.4% | +0.55 | **0.030** | **3.0%** | Standardized to 3% to match Momentum/Handling. |
| **Momentum** | 0.020 | 2.0% | +1.30 | **0.030** | **3.0%** | Increased to match Acceleration. |
| **Handling** | 0.030 | 3.0% | -0.03 | **0.040** | **4.0%** | Increased significantly to make it matter. |
| **Upwind** | 0.008 | 0.8% | -0.61 | **0.025** | **2.5%** | **Tripled** (3x) to match `boost` impact. |
| **Reach** | 0.012 | 1.2% | -0.09 | **0.025** | **2.5%** | Standardized with Upwind. |
| **Downwind** | 0.010 | 1.0% | +1.47 | **0.025** | **2.5%** | Standardized with Upwind. |
| **Boost** | 0.050 | 5.0% | -1.92 | **0.040** | **4.0%** | Reduced slightly to balance against increased sailing stats. |

## Character Rebalance

Using the new multipliers, we ran an iterative solver to adjust the stat blocks of all 66 AI characters. The solver tweaked stats (+/- 1) to ensure the total "Power Score" (Sum of Stat * Multiplier) for each character remained close to 0, preserving fairness while respecting their "personality" (stat distribution shape).
