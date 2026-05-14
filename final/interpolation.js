'use strict';
/**
 * @file interpolation.js
 * @description Polynomial interpolation: Lagrange and Newton forms.
 * Lab 4 — Function Approximation: Interpolation & Least Squares
 */

/**
 * Lagrange polynomial interpolation.
 * P(x) = Σ y_k · L_k(x),  L_k(x) = Π (x−x_j)/(x_k−x_j) for j≠k
 */
class LagrangeInterpolator {
  /**
   * @param {Array<{x:number,y:number}>} points  – interpolation nodes
   */
  constructor(points) {
    this.points = [...points].sort((a, b) => a.x - b.x);
  }

  /**
   * Evaluate the Lagrange polynomial at x using the first nodeCount nodes.
   * @param {number}  x
   * @param {number} [nodeCount]  – default: all points
   * @returns {number}
   */
  evaluate(x, nodeCount) {
    const pts = this.points.slice(0, nodeCount ?? this.points.length);
    const n = pts.length;
    if (n === 0) return NaN;
    if (n === 1) return pts[0].y;

    let result = 0;
    for (let k = 0; k < n; k++) {
      let basis = pts[k].y;
      for (let j = 0; j < n; j++) {
        if (j === k) continue;
        const denom = pts[k].x - pts[j].x;
        if (Math.abs(denom) < 1e-14) continue; // guard against duplicate nodes
        basis *= (x - pts[j].x) / denom;
      }
      result += basis;
    }
    return result;
  }

  /**
   * Evaluate at an array of x values.
   * @param {number[]} xs
   * @param {number}  [nodeCount]
   * @returns {number[]}
   */
  evaluateAt(xs, nodeCount) {
    return xs.map(x => this.evaluate(x, nodeCount));
  }

  get length() { return this.points.length; }
}


/**
 * Newton polynomial interpolation via divided differences.
 * P(x) = a_0 + a_1(x−x_0) + a_2(x−x_0)(x−x_1) + …
 * a_k = f[x_0, x_1, …, x_k]  (k-th divided difference)
 */
class NewtonInterpolator {
  /**
   * @param {Array<{x:number,y:number}>} points
   */
  constructor(points) {
    this.points = [...points].sort((a, b) => a.x - b.x);
    this._table  = null;  // full divided differences table
    this._coeffs = null;  // Newton coefficients = first column of table
    this._build();
  }

  /**
   * Build divided differences table.
   * table[order][start_index] = f[x_{start}, …, x_{start+order}]
   */
  _build() {
    const pts = this.points;
    const n   = pts.length;
    const tbl = Array.from({ length: n }, () => new Array(n).fill(0));

    // Order 0: function values
    for (let i = 0; i < n; i++) tbl[0][i] = pts[i].y;

    // Higher orders
    for (let order = 1; order < n; order++) {
      for (let i = 0; i < n - order; i++) {
        const dx = pts[i + order].x - pts[i].x;
        tbl[order][i] = Math.abs(dx) < 1e-14
          ? 0
          : (tbl[order - 1][i + 1] - tbl[order - 1][i]) / dx;
      }
    }

    this._table  = tbl;
    this._coeffs = tbl.map(row => row[0]);  // a_k = table[k][0]
  }

  /**
   * Evaluate Newton polynomial at x using first nodeCount nodes.
   * @param {number}  x
   * @param {number} [nodeCount]
   * @returns {number}
   */
  evaluate(x, nodeCount) {
    const nc  = nodeCount ?? this.points.length;
    if (nc === 0) return NaN;
    let result  = this._coeffs[0];
    let product = 1;
    for (let k = 1; k < nc; k++) {
      product *= (x - this.points[k - 1].x);
      result  += this._coeffs[k] * product;
    }
    return result;
  }

  /**
   * @param {number[]} xs
   * @param {number}  [nodeCount]
   * @returns {number[]}
   */
  evaluateAt(xs, nodeCount) {
    return xs.map(x => this.evaluate(x, nodeCount));
  }

  /**
   * Return structured divided differences data for table display.
   * @returns {{ xs:number[], ys:number[], table:number[][], n:number }}
   */
  getDividedDiffsTable() {
    return {
      xs   : this.points.map(p => p.x),
      ys   : this.points.map(p => p.y),
      table: this._table,
      n    : this.points.length,
    };
  }

  get length() { return this.points.length; }
}
