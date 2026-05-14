'use strict';
/**
 * @file chartRenderer.js
 * @description Canvas-based chart renderer.
 * Handles coordinate transforms, grid, axes, smooth curves,
 * data points, residual lines, and legend.
 */

class ChartRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ padding?:number }} [opts]
   */
  constructor(canvas, opts = {}) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.padding = opts.padding ?? 60;

    // Math-space viewport (set via fitToPoints or directly)
    this.xMin = -1;  this.xMax = 10;
    this.yMin = -1;  this.yMax = 10;

    this.colors = {
      bg           : '#0A0500',
      grid         : '#1E1000',
      gridMinor    : '#160A00',
      axis         : '#F97316',
      axisDim      : '#7A4A20',
      tickLabel    : '#9A6A3A',
      point        : '#F59E0B',
      pointStroke  : '#F97316',
      interpCurve  : '#F97316',
      lsmCurve     : '#60A5FA',
      residualPos  : '#22C55E',
      residualNeg  : '#EF4444',
      activeNode   : '#FFFFFF',
      legend       : '#D1C4B0',
    };
  }

  // ── Sizing ───────────────────────────────────────────────────────────────

  /** Resize canvas to fill its container. Returns true if dimensions changed. */
  resize() {
    const container = this.canvas.parentElement;
    const w = container.clientWidth  || 600;
    const h = container.clientHeight || 400;
    const dpr = window.devicePixelRatio || 1;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width  = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width  = w + 'px';
      this.canvas.style.height = h + 'px';
      this.ctx.scale(dpr, dpr);
      this._logW = w;
      this._logH = h;
      return true;
    }
    this._logW = this.canvas.width  / (window.devicePixelRatio || 1);
    this._logH = this.canvas.height / (window.devicePixelRatio || 1);
    return false;
  }

  get _w() { return this._logW || this.canvas.width; }
  get _h() { return this._logH || this.canvas.height; }

  // ── Viewport ─────────────────────────────────────────────────────────────

  /**
   * Auto-fit viewport to the given data points with a margin factor.
   * @param {Array<{x:number,y:number}>} points
   * @param {number} [margin=0.18]
   */
  fitToPoints(points, margin = 0.18) {
    if (!points.length) return;
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const p of points) {
      if (p.x < xMin) xMin = p.x;
      if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
    const dx = xMax - xMin || 2;
    const dy = yMax - yMin || 2;
    this.xMin = xMin - dx * margin;
    this.xMax = xMax + dx * margin;
    this.yMin = yMin - dy * margin;
    this.yMax = yMax + dy * margin;
  }

  /** Expand yMin/yMax to include an array of y values. */
  expandY(ys, margin = 0.08) {
    const finiteYs = ys.filter(Number.isFinite);
    if (!finiteYs.length) return;
    const mn = Math.min(...finiteYs);
    const mx = Math.max(...finiteYs);
    const dy = mx - mn || 1;
    if (mn - dy * margin < this.yMin) this.yMin = mn - dy * margin;
    if (mx + dy * margin > this.yMax) this.yMax = mx + dy * margin;
  }

  // ── Coordinate transforms ─────────────────────────────────────────────────

  toCanvasX(x) {
    return this.padding + (x - this.xMin) / (this.xMax - this.xMin) * (this._w - 2 * this.padding);
  }
  toCanvasY(y) {
    return this._h - this.padding - (y - this.yMin) / (this.yMax - this.yMin) * (this._h - 2 * this.padding);
  }
  toMathX(cx) {
    return this.xMin + (cx - this.padding) / (this._w - 2 * this.padding) * (this.xMax - this.xMin);
  }
  toMathY(cy) {
    return this.yMin + (this._h - this.padding - cy) / (this._h - 2 * this.padding) * (this.yMax - this.yMin);
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  clear() {
    const ctx = this.ctx;
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, this._w, this._h);

    // Subtle scanline texture
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let y = 0; y < this._h; y += 4) {
      ctx.fillRect(0, y, this._w, 1);
    }
  }

  drawGrid() {
    const ctx = this.ctx;
    const { xMin, xMax, yMin, yMax } = this;
    ctx.save();

    const N = 8;
    const xStep = (xMax - xMin) / N;
    const yStep = (yMax - yMin) / N;

    // Minor grid
    ctx.strokeStyle = this.colors.gridMinor;
    ctx.lineWidth   = 0.5;
    ctx.setLineDash([2, 6]);
    for (let i = 0; i <= N * 2; i++) {
      const x = xMin + i * xStep / 2;
      ctx.beginPath();
      ctx.moveTo(this.toCanvasX(x), this.toCanvasY(yMin));
      ctx.lineTo(this.toCanvasX(x), this.toCanvasY(yMax));
      ctx.stroke();
      const y = yMin + i * yStep / 2;
      ctx.beginPath();
      ctx.moveTo(this.toCanvasX(xMin), this.toCanvasY(y));
      ctx.lineTo(this.toCanvasX(xMax), this.toCanvasY(y));
      ctx.stroke();
    }

    // Major grid
    ctx.strokeStyle = this.colors.grid;
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 6]);
    for (let i = 0; i <= N; i++) {
      const x = xMin + i * xStep;
      ctx.beginPath();
      ctx.moveTo(this.toCanvasX(x), this.toCanvasY(yMin));
      ctx.lineTo(this.toCanvasX(x), this.toCanvasY(yMax));
      ctx.stroke();
      const y = yMin + i * yStep;
      ctx.beginPath();
      ctx.moveTo(this.toCanvasX(xMin), this.toCanvasY(y));
      ctx.lineTo(this.toCanvasX(xMax), this.toCanvasY(y));
      ctx.stroke();
    }

    ctx.restore();
  }

  drawAxes() {
    const ctx = this.ctx;
    const { xMin, xMax, yMin, yMax } = this;
    ctx.save();

    // Determine axis positions
    const axisY = (yMin <= 0 && yMax >= 0) ? 0 : yMin;
    const axisX = (xMin <= 0 && xMax >= 0) ? 0 : xMin;

    // Axes
    ctx.strokeStyle = this.colors.axis;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([]);
    ctx.shadowBlur  = 4;
    ctx.shadowColor = this.colors.axis;

    ctx.beginPath();
    ctx.moveTo(this.toCanvasX(xMin), this.toCanvasY(axisY));
    ctx.lineTo(this.toCanvasX(xMax), this.toCanvasY(axisY));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(this.toCanvasX(axisX), this.toCanvasY(yMin));
    ctx.lineTo(this.toCanvasX(axisX), this.toCanvasY(yMax));
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Tick labels
    const N   = 6;
    ctx.font  = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = this.colors.tickLabel;
    ctx.textAlign = 'center';

    for (let i = 0; i <= N; i++) {
      const x  = xMin + i * (xMax - xMin) / N;
      const cx = this.toCanvasX(x);
      const cy = this.toCanvasY(axisY);
      // Tick mark
      ctx.strokeStyle = this.colors.axisDim;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 3);
      ctx.lineTo(cx, cy + 3);
      ctx.stroke();
      ctx.fillText(this._fmt(x), cx, cy + 15);
    }

    ctx.textAlign = 'right';
    for (let i = 0; i <= N; i++) {
      const y  = yMin + i * (yMax - yMin) / N;
      const cx = this.toCanvasX(axisX);
      const cy = this.toCanvasY(y);
      ctx.strokeStyle = this.colors.axisDim;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy);
      ctx.lineTo(cx + 3, cy);
      ctx.stroke();
      ctx.fillText(this._fmt(y), cx - 6, cy + 4);
    }

    // Axis labels
    ctx.fillStyle = this.colors.axis;
    ctx.font      = 'bold 12px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('x', this._w - this.padding / 3, this.toCanvasY(axisY) + 1);
    ctx.textAlign = 'left';
    ctx.fillText('y', this.toCanvasX(axisX) + 6, this.padding - 4);

    ctx.restore();
  }

  /**
   * Draw a smooth curve by evaluating evaluateFn at many x points.
   * @param {function(x:number):number} evaluateFn
   * @param {{ color?:string, lineWidth?:number, dash?:number[], glow?:boolean }} [style]
   */
  drawCurve(evaluateFn, style = {}) {
    const ctx    = this.ctx;
    const STEPS  = 600;
    const dx     = (this.xMax - this.xMin) / STEPS;

    ctx.save();
    ctx.strokeStyle = style.color     ?? this.colors.interpCurve;
    ctx.lineWidth   = style.lineWidth ?? 2.5;
    ctx.setLineDash(style.dash        ?? []);

    if (style.glow) {
      ctx.shadowBlur  = 10;
      ctx.shadowColor = style.color ?? this.colors.interpCurve;
    }

    ctx.beginPath();
    let started = false;
    let prevOOB = false;

    for (let i = 0; i <= STEPS; i++) {
      const x  = this.xMin + i * dx;
      const y  = evaluateFn(x);
      if (!Number.isFinite(y)) { started = false; prevOOB = true; continue; }

      // Clamp wildly out-of-bounds values (Runge phenomenon)
      const yRange = this.yMax - this.yMin;
      if (y < this.yMin - yRange * 2 || y > this.yMax + yRange * 2) {
        started = false; prevOOB = true; continue;
      }

      const cx = this.toCanvasX(x);
      const cy = this.toCanvasY(y);

      if (!started || prevOOB) { ctx.moveTo(cx, cy); started = true; prevOOB = false; }
      else ctx.lineTo(cx, cy);
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw data points as circles with optional active-node highlight.
   * @param {Array<{x:number,y:number}>} points
   * @param {{ fill?:string, stroke?:string, radius?:number }} [style]
   * @param {number} [activeIndex]  – index of the most-recently added node
   */
  drawPoints(points, style = {}, activeIndex = -1) {
    const ctx = this.ctx;
    ctx.save();

    for (let i = 0; i < points.length; i++) {
      const { x, y } = points[i];
      const cx       = this.toCanvasX(x);
      const cy       = this.toCanvasY(y);
      const isActive = (i === activeIndex);
      const r        = isActive ? 9 : (style.radius ?? 5);

      if (isActive) {
        // Outer glow ring
        ctx.beginPath();
        ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill();
        ctx.shadowBlur  = 20;
        ctx.shadowColor = '#FFFFFF';
      } else {
        ctx.shadowBlur  = 6;
        ctx.shadowColor = style.stroke ?? this.colors.pointStroke;
      }

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle   = isActive ? '#FFFFFF' : (style.fill ?? this.colors.point);
      ctx.fill();
      ctx.strokeStyle = isActive ? '#F97316' : (style.stroke ?? this.colors.pointStroke);
      ctx.lineWidth   = isActive ? 2.5 : 2;
      ctx.stroke();
      ctx.shadowBlur  = 0;
    }

    ctx.restore();
  }

  /**
   * Draw residual lines from (xᵢ, yᵢ) to (xᵢ, ŷᵢ).
   * Positive residuals in green, negative in red.
   * @param {Array<{x,y,predicted,residual}>} residuals
   * @param {number} [count]  – how many to draw (for step animation)
   */
  drawResiduals(residuals, count) {
    const ctx   = this.ctx;
    const items = count != null ? residuals.slice(0, count) : residuals;
    ctx.save();
    ctx.lineWidth   = 2;
    ctx.setLineDash([3, 4]);
    ctx.shadowBlur  = 5;

    for (const res of items) {
      const color     = res.residual >= 0 ? this.colors.residualPos : this.colors.residualNeg;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.moveTo(this.toCanvasX(res.x), this.toCanvasY(res.y));
      ctx.lineTo(this.toCanvasX(res.x), this.toCanvasY(res.predicted));
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draw a legend in the top-right corner.
   * @param {Array<{color:string, label:string, dash?:number[]}>} items
   */
  drawLegend(items) {
    if (!items.length) return;
    const ctx   = this.ctx;
    const lw    = 140;
    const lh    = items.length * 20 + 12;
    const x0    = this._w - this.padding - lw - 4;
    const y0    = this.padding + 4;

    ctx.save();
    // Background
    ctx.fillStyle = 'rgba(8,3,0,0.75)';
    ctx.strokeStyle = '#3A2000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x0 - 6, y0 - 6, lw + 12, lh, 4);
    ctx.fill();
    ctx.stroke();

    // Items
    ctx.font      = '11px Rajdhani, sans-serif';
    ctx.textAlign = 'left';
    let y = y0 + 8;

    for (const item of items) {
      ctx.strokeStyle = item.color;
      ctx.lineWidth   = item.lineWidth ?? 2.5;
      ctx.setLineDash(item.dash ?? []);
      ctx.shadowBlur  = 4;
      ctx.shadowColor = item.color;
      ctx.beginPath();
      ctx.moveTo(x0, y); ctx.lineTo(x0 + 22, y);
      ctx.stroke();
      ctx.shadowBlur  = 0;
      ctx.setLineDash([]);
      ctx.fillStyle   = this.colors.legend;
      ctx.fillText(item.label, x0 + 28, y + 4);
      y += 20;
    }

    ctx.restore();
  }

  /** Draw a placeholder message on an empty canvas. */
  drawEmptyMessage(msg) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#5A3A1A';
    ctx.font      = '14px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(msg, this._w / 2, this._h / 2);
    ctx.restore();
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  /** Format a number compactly for tick labels. */
  _fmt(v) {
    if (Math.abs(v) < 1e-10) return '0';
    if (Math.abs(v) >= 10000 || (Math.abs(v) < 0.001 && v !== 0))
      return v.toExponential(1);
    if (Math.abs(v) >= 100) return (+v.toFixed(0)) + '';
    if (Math.abs(v) >= 10)  return (+v.toFixed(1)) + '';
    return (+v.toFixed(2)) + '';
  }
}
