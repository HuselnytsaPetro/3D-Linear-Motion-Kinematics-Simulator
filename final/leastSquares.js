'use strict';
/**
 * @file leastSquares.js
 * @description Polynomial Least-Squares (МНК) solver.
 * Uses Modified Gram-Schmidt QR decomposition for numerical stability,
 * then solves R·θ = Qᵀ·y by back-substitution.
 * Avoids forming the normal equations (AᵀA)θ = Aᵀy directly.
 */

class LeastSquaresSolver {
  /**
   * @param {Array<{x:number,y:number}>} points  – data points
   * @param {number} degree                       – polynomial degree (2, 3, or 4)
   */
  constructor(points, degree) {
    this.points       = [...points].sort((a, b) => a.x - b.x);
    this.degree       = Math.min(degree, points.length - 1);
    this.coefficients = null;  // [a₀, a₁, …, aₘ] for P(x)=Σaᵢxⁱ
    this.residuals    = null;  // [{x, y, predicted, residual}]
    this.rmse         = null;
    this.r2           = null;
    this._animCoeffs  = [];    // pre-computed animation frames
  }

  /**
   * Run the LSM computation.
   * @returns {LeastSquaresSolver}  this (for chaining)
   */
  solve() {
    const { points, degree } = this;
    const n = points.length;
    const m = degree + 1;  // number of polynomial coefficients

    // ── 1. Build Vandermonde-like design matrix A (n×m) ──
    const A    = points.map(p =>
      Array.from({ length: m }, (_, j) => Math.pow(p.x, j))
    );
    const bVec = points.map(p => p.y);

    // ── 2. QR decomposition via Modified Gram-Schmidt ──
    const { Q, R } = this._qrModifiedGS(A, n, m);

    // ── 3. Compute Qᵀb ──
    const Qtb = new Array(m).fill(0);
    for (let j = 0; j < m; j++)
      for (let i = 0; i < n; i++)
        Qtb[j] += Q[i][j] * bVec[i];

    // ── 4. Back-substitution: solve R·θ = Qᵀb ──
    this.coefficients = this._backSub(R, Qtb, m);

    // ── 5. Residuals, RMSE, R² ──
    const yMean = bVec.reduce((s, v) => s + v, 0) / n;
    let ssRes = 0, ssTot = 0;
    this.residuals = points.map(p => {
      const predicted = this.evaluate(p.x);
      const r         = p.y - predicted;
      ssRes += r * r;
      ssTot += (p.y - yMean) ** 2;
      return { x: p.x, y: p.y, predicted, residual: r };
    });
    this.rmse = Math.sqrt(ssRes / n);
    this.r2   = ssTot > 1e-14 ? Math.max(0, 1 - ssRes / ssTot) : 1;

    // ── 6. Pre-compute animation frames ──
    this._buildAnimFrames(yMean);
    return this;
  }

  /**
   * Evaluate the fitted polynomial at x.
   * @param {number}  x
   * @param {number[]} [coeffs]  – optional override
   * @returns {number}
   */
  evaluate(x, coeffs) {
    const c = coeffs ?? this.coefficients;
    if (!c) return 0;
    return c.reduce((sum, ci, i) => sum + ci * Math.pow(x, i), 0);
  }

  /**
   * Return interpolated coefficients for animation frame (progress 0→1).
   * Coefficients start at [yMean, 0, 0, …] and move to the final fit.
   * @param {number} progress  – 0 to 1
   * @returns {number[]}
   */
  getAnimCoeffs(progress) {
    if (!this._animCoeffs.length) return this.coefficients ?? [];
    const idx = Math.min(
      Math.floor(progress * (this._animCoeffs.length - 1)),
      this._animCoeffs.length - 1
    );
    return this._animCoeffs[idx];
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Modified Gram-Schmidt QR decomposition.
   * More numerically stable than classical Gram-Schmidt.
   * @param {number[][]} A  – rows × cols matrix
   * @param {number} rows
   * @param {number} cols
   * @returns {{ Q:number[][], R:number[][] }}
   */
  _qrModifiedGS(A, rows, cols) {
    const Q = Array.from({ length: rows }, () => new Array(cols).fill(0));
    const R = Array.from({ length: cols }, () => new Array(cols).fill(0));

    // Work on a column-major copy
    const V = Array.from({ length: cols }, (_, j) => A.map(row => row[j]));

    for (let j = 0; j < cols; j++) {
      // Modified GS: subtract projections onto already-orthogonalized Q columns
      let col = [...V[j]];
      for (let k = 0; k < j; k++) {
        const qk   = Q.map(row => row[k]);
        const r_kj = this._dot(qk, col);
        R[k][j]    = r_kj;
        col        = col.map((v, i) => v - r_kj * qk[i]);
      }

      const norm = Math.sqrt(this._dot(col, col));
      R[j][j]    = norm;

      if (norm < 1e-12) {
        for (let i = 0; i < rows; i++) Q[i][j] = 0;
      } else {
        for (let i = 0; i < rows; i++) Q[i][j] = col[i] / norm;
      }
    }
    return { Q, R };
  }

  /** Solve upper triangular R·x = b by back substitution. */
  _backSub(R, b, n) {
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = b[i];
      for (let j = i + 1; j < n; j++) s -= R[i][j] * x[j];
      x[i] = Math.abs(R[i][i]) > 1e-12 ? s / R[i][i] : 0;
    }
    return x;
  }

  /** Dot product. */
  _dot(a, b) { return a.reduce((s, v, i) => s + v * b[i], 0); }

  /**
   * Pre-compute FRAMES+1 animation keyframes.
   * Coefficients go from [yMean, 0, …] to the final fitted coefficients
   * using an ease-in-out curve.
   */
  _buildAnimFrames(yMean) {
    const FRAMES = 90;
    const start  = [yMean, ...new Array(this.degree).fill(0)];
    const end    = this.coefficients;
    this._animCoeffs = [];
    for (let f = 0; f <= FRAMES; f++) {
      const t      = f / FRAMES;
      const eased  = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease-in-out
      this._animCoeffs.push(
        start.map((s, i) => s + eased * (end[i] - s))
      );
    }
  }
}
