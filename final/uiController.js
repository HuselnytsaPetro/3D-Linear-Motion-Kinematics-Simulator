'use strict';
/**
 * @file uiController.js
 * @description UIController — central coordinator between DOM, algorithms,
 * animation, and rendering. Follows the Single Responsibility Principle.
 */

class UIController {
  /**
   * @param {ChartRenderer}    renderer      – main plot canvas renderer
   * @param {ChartRenderer}    residRenderer – residuals chart renderer
   * @param {AnimationManager} animManager
   */
  constructor(renderer, residRenderer, animManager) {
    this._r     = renderer;
    this._rr    = residRenderer;
    this._anim  = animManager;

    // Computed objects (null until _handleRun)
    this._lagrange = null;
    this._newton   = null;
    this._lsm      = null;

    // UI state
    this._points  = [];
    this._algo    = 'lagrange';   // 'lagrange' | 'newton' | 'lsm'
    this._degree  = 2;
    this._mode    = 'interp';     // 'interp' | 'lsm' | 'all'

    this._presets = {
      sin: [
        { x: 0,    y: 0     }, { x: 0.52, y: 0.5   }, { x: 1.05, y: 0.866 },
        { x: 1.57, y: 1     }, { x: 2.09, y: 0.866 }, { x: 2.62, y: 0.5   },
        { x: 3.14, y: 0     },
      ],
      poly: [
        { x: -3, y: 9 }, { x: -2, y: 4 }, { x: -1, y: 1 },
        { x: 0,  y: 0 }, { x: 1,  y: 1 }, { x: 2,  y: 4 }, { x: 3, y: 9 },
      ],
      exp: [
        { x: 0,   y: 1    }, { x: 0.5, y: 1.65 }, { x: 1,   y: 2.72 },
        { x: 1.5, y: 4.48 }, { x: 2,   y: 7.39 },
      ],
      custom: [
        { x: 1, y: 2.5 }, { x: 2, y: 3.1 }, { x: 3, y: 4.8 },
        { x: 4, y: 3.9 }, { x: 5, y: 5.5 }, { x: 6, y: 4.7 }, { x: 7, y: 6.1 },
      ],
    };
  }

  // ── Initialization ────────────────────────────────────────────────────────

  init() {
    this._bindEvents();
    this._setupResize();
    // Load default preset
    this._loadPreset('sin');
    document.getElementById('preset-select').value = 'sin';
    this._renderEmpty();
  }

  // ── Event binding ─────────────────────────────────────────────────────────

  _bindEvents() {
    // Preset
    document.getElementById('preset-select').addEventListener('change', e => {
      if (e.target.value) this._loadPreset(e.target.value);
    });

    // Algorithm radio
    document.querySelectorAll('input[name="algo"]').forEach(r =>
      r.addEventListener('change', e => {
        this._algo = e.target.value;
        this._syncDegreeRow();
      })
    );

    // Degree buttons
    document.querySelectorAll('.btn-degree').forEach(btn =>
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-degree').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._degree = parseInt(btn.dataset.deg, 10);
      })
    );

    // Display mode
    document.getElementById('display-mode').addEventListener('change', e => {
      this._mode = e.target.value;
      if (this._points.length) this._redraw();
    });

    // Speed slider
    const slider = document.getElementById('speed-slider');
    const label  = document.getElementById('speed-label');
    slider.addEventListener('input', () => {
      this._anim.setSpeed(parseInt(slider.value, 10));
      label.textContent = slider.value + 'мс';
    });

    // Control buttons
    document.getElementById('btn-run').addEventListener('click',      () => this._handleRun());
    document.getElementById('btn-pause').addEventListener('click',    () => this._handlePause());
    document.getElementById('btn-step-back').addEventListener('click',() => this._handleStepBack());
    document.getElementById('btn-step-fwd').addEventListener('click', () => this._handleStepFwd());
    document.getElementById('btn-reset').addEventListener('click',    () => this._handleReset());

    // Canvas hover tooltip
    this._r.canvas.addEventListener('mousemove',  e => this._handleHover(e));
    this._r.canvas.addEventListener('mouseleave', ()  => this._hideTooltip());

    // Animation callbacks
    this._anim.onStep     = (s, t) => { this._redraw(); this._updateProgress(s, t); };
    this._anim.onFinish   = ()     => { this._onFinish(); };
    this._anim.onProgress = (s, t) => this._updateProgress(s, t);
  }

  _setupResize() {
    const ro = new ResizeObserver(() => {
      this._points.length ? this._redraw() : this._renderEmpty();
    });
    ro.observe(document.getElementById('canvas-container'));
    ro.observe(document.getElementById('residuals-canvas').parentElement);
  }

  // ── Presets & parsing ─────────────────────────────────────────────────────

  _loadPreset(key) {
    const pts = this._presets[key];
    if (!pts) return;
    document.getElementById('points-input').value = pts.map(p => `${p.x}, ${p.y}`).join('\n');
    this._points = [...pts];
    this._toast(`✓ Пресет завантажено (${pts.length} точок)`, 'success');
  }

  _parsePoints() {
    const raw   = document.getElementById('points-input').value.trim();
    if (!raw) { this._toast('Введіть хоча б 2 точки', 'error'); return null; }

    const lines = raw.split(/[;\n]+/).map(s => s.trim()).filter(Boolean);
    const pts   = [];

    for (const line of lines) {
      const parts = line.split(',');
      if (parts.length < 2) continue;
      const x = parseFloat(parts[0]);
      const y = parseFloat(parts[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        this._toast(`Некоректна точка: "${line}"`, 'error');
        return null;
      }
      pts.push({ x, y });
    }

    if (pts.length < 2) { this._toast('Потрібно мінімум 2 точки', 'error'); return null; }

    // For interpolation: check unique x values
    if (this._algo !== 'lsm') {
      const xs = pts.map(p => Math.round(p.x * 1e9));
      if (new Set(xs).size !== pts.length) {
        this._toast('Інтерполяція потребує унікальних значень x', 'error');
        return null;
      }
    }

    return pts;
  }

  // ── Run / Reset ───────────────────────────────────────────────────────────

  _handleRun() {
    const pts = this._parsePoints();
    if (!pts) return;
    this._points = pts;
    this._anim.reset();
    this._lagrange = null;
    this._newton   = null;
    this._lsm      = null;

    try {
      // Always build interpolators (needed for 'all' display mode)
      this._lagrange = new LagrangeInterpolator(pts);
      this._newton   = new NewtonInterpolator(pts);
      // Build LSM if needed
      if (this._algo === 'lsm' || this._mode === 'lsm' || this._mode === 'all') {
        const deg  = Math.min(this._degree, pts.length - 1);
        this._lsm  = new LeastSquaresSolver(pts, deg).solve();
      }
    } catch (err) {
      this._toast('Помилка обчислення: ' + err.message, 'error');
      return;
    }

    // Fit viewport
    this._r.fitToPoints(pts);
    this._expandViewport();

    // Setup animation
    if (this._algo === 'lsm' && this._lsm) {
      this._anim.setupLSM(this._lsm._animCoeffs.length);
    } else {
      this._anim.setupInterpolation(pts.length);
    }

    this._setButtonsComputed(true);
    this._updateMetrics();
    this._updateDivDiffsTable();
    this._toast('✓ Обчислено — запускаю анімацію', 'success');
    this._anim.playAll();
  }

  _handleReset() {
    this._anim.reset();
    this._lagrange = null;
    this._newton   = null;
    this._lsm      = null;
    this._points   = [];
    this._setButtonsComputed(false);
    this._clearMetrics();
    this._renderEmpty();
    document.getElementById('divdiffs-section').classList.add('hidden');
  }

  _handlePause() {
    const btn = document.getElementById('btn-pause');
    if (this._anim.isPlaying) {
      this._anim.pause();
      btn.textContent = '▶ ПРОДОВЖИТИ';
    } else {
      btn.textContent = '⏸ ПАУЗА';
      this._anim.playAll();
    }
  }

  _handleStepBack() {
    this._anim.pause();
    document.getElementById('btn-pause').textContent = '▶ ПРОДОВЖИТИ';
    this._anim.prevStep();
  }

  _handleStepFwd() {
    this._anim.pause();
    document.getElementById('btn-pause').textContent = '▶ ПРОДОВЖИТИ';
    this._anim.nextStep();
  }

  _onFinish() {
    this._setButtonsComputed(true);
    document.getElementById('btn-pause').textContent = '⏸ ПАУЗА';
    this._redraw();   // ensure final state is shown
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  _redraw() {
    const r = this._r;
    r.resize();
    r.clear();
    r.drawGrid();
    r.drawAxes();

    if (!this._points.length) return;

    const step  = this._anim.currentStep;
    const total = this._anim.totalSteps;

    // ── Interpolation curve ──────────────────────────────────────────────
    const showInterp = this._mode === 'interp' || this._mode === 'all';
    if (showInterp) {
      const interp = this._algo === 'newton' ? this._newton : this._lagrange;
      if (interp) {
        let nodeCount;
        if (this._algo === 'lsm') {
          nodeCount = this._points.length;  // show all nodes when animating LSM
        } else {
          nodeCount = Math.max(1, step + 2);  // step -1 → 1 node, step 0 → 2, …
          nodeCount = Math.min(nodeCount, this._points.length);
        }

        r.drawCurve(x => interp.evaluate(x, nodeCount), {
          color: r.colors.interpCurve, lineWidth: 2.5, glow: true,
        });

        const activeIdx = (this._algo !== 'lsm') ? Math.min(nodeCount - 1, this._points.length - 1) : -1;
        r.drawPoints(interp.points.slice(0, nodeCount), {}, activeIdx);
      }
    }

    // ── LSM curve ────────────────────────────────────────────────────────
    const showLSM = this._mode === 'lsm' || this._mode === 'all';
    if (showLSM && this._lsm) {
      if (this._algo === 'lsm') {
        // Animated growth
        const progress = total > 0 ? (step + 1) / total : 1;
        const clampProg = Math.max(0, Math.min(1, progress));
        const coeffs   = this._lsm.getAnimCoeffs(clampProg);

        r.drawCurve(x => this._lsm.evaluate(x, coeffs), {
          color: '#60A5FA', lineWidth: 2.5, glow: true,
        });

        // Animate residuals in the final 20% of frames
        if (clampProg >= 0.80 && this._lsm.residuals) {
          const residProg = Math.min(1, (clampProg - 0.80) / 0.20);
          const nResid    = Math.floor(residProg * this._lsm.residuals.length);
          r.drawResiduals(this._lsm.residuals, nResid);
        }
      } else {
        // Static dashed line when not primary algo
        r.drawCurve(x => this._lsm.evaluate(x), {
          color: '#60A5FA', lineWidth: 1.8, dash: [6, 4],
        });
        r.drawResiduals(this._lsm.residuals);
      }
      if (this._mode === 'lsm') {
        r.drawPoints(this._points, { fill: '#F59E0B', stroke: '#60A5FA' }, -1);
      }
    }

    // ── Legend ───────────────────────────────────────────────────────────
    const legendItems = [];
    if (showInterp && this._lagrange) {
      legendItems.push({
        color: r.colors.interpCurve,
        label: this._algo === 'newton' ? 'Ньютон' : 'Лагранж',
      });
    }
    if (showLSM && this._lsm) {
      legendItems.push({ color: '#60A5FA', label: `МНК (ст.${this._lsm.degree})` });
      legendItems.push({ color: '#22C55E', dash: [3, 4], label: 'Залишки', lineWidth: 1.5 });
    }
    r.drawLegend(legendItems);

    // ── Residuals chart ──────────────────────────────────────────────────
    this._drawResidualsChart();
  }

  _renderEmpty() {
    const r = this._r;
    r.resize();
    r.clear();
    r.drawGrid();
    r.drawAxes();
    r.drawEmptyMessage('Введіть точки та натисніть «ЗАПУСТИТИ»');
    this._drawResidualsChart(true);
  }

  _drawResidualsChart(empty = false) {
    const rr = this._rr;
    rr.resize();
    rr.clear();

    if (empty || !this._lsm?.residuals?.length) {
      rr.drawEmptyMessage('Залишки з\'являться після запуску МНК');
      return;
    }

    const res    = this._lsm.residuals;
    const rVals  = res.map(r => r.residual);
    const absMax = Math.max(...rVals.map(Math.abs), 0.01);
    const xs     = res.map(r => r.x);
    const dx     = (Math.max(...xs) - Math.min(...xs)) || 1;

    rr.xMin = Math.min(...xs) - dx * 0.12;
    rr.xMax = Math.max(...xs) + dx * 0.12;
    rr.yMin = -absMax * 1.5;
    rr.yMax =  absMax * 1.5;

    rr.drawGrid();

    const ctx = rr.ctx;
    // Zero line
    ctx.save();
    ctx.strokeStyle = '#F97316';
    ctx.lineWidth   = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(rr.toCanvasX(rr.xMin), rr.toCanvasY(0));
    ctx.lineTo(rr.toCanvasX(rr.xMax), rr.toCanvasY(0));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#F97316';
    ctx.font      = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('y = 0', rr.toCanvasX(rr.xMin) + 5, rr.toCanvasY(0) - 5);
    ctx.restore();

    // Stem plot for residuals
    for (const res_i of res) {
      const col = res_i.residual >= 0 ? '#22C55E' : '#EF4444';
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth   = 2;
      ctx.shadowBlur  = 4;
      ctx.shadowColor = col;
      ctx.beginPath();
      ctx.moveTo(rr.toCanvasX(res_i.x), rr.toCanvasY(0));
      ctx.lineTo(rr.toCanvasX(res_i.x), rr.toCanvasY(res_i.residual));
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(rr.toCanvasX(res_i.x), rr.toCanvasY(res_i.residual), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Label
    ctx.save();
    ctx.fillStyle = '#7A5A30';
    ctx.font      = '10px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('rᵢ = yᵢ − ŷᵢ', rr._w / 2, 13);
    ctx.restore();
  }

  // ── Viewport ──────────────────────────────────────────────────────────────

  _expandViewport() {
    const r  = this._r;
    const xs = Array.from({ length: 200 }, (_, i) =>
      r.xMin + i * (r.xMax - r.xMin) / 199
    );
    const ys = [];

    if (this._lagrange) xs.forEach(x => { const y = this._lagrange.evaluate(x); if (Number.isFinite(y)) ys.push(y); });
    if (this._lsm)      xs.forEach(x => { const y = this._lsm.evaluate(x);      if (Number.isFinite(y)) ys.push(y); });

    r.expandY(ys);
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────

  _handleHover(e) {
    const rect  = this._r.canvas.getBoundingClientRect();
    const cx    = (e.clientX - rect.left) * (this._r.canvas.width  / rect.width  / (window.devicePixelRatio || 1));
    const cy    = (e.clientY - rect.top)  * (this._r.canvas.height / rect.height / (window.devicePixelRatio || 1));
    const mx    = this._r.toMathX(cx / (window.devicePixelRatio || 1));

    // Find nearest data point (in canvas px distance)
    let nearest = null, minDist = Infinity;
    for (const p of this._points) {
      const dcx   = this._r.toCanvasX(p.x) - cx;
      const dcy   = this._r.toCanvasY(p.y) - cy;
      const dist  = Math.sqrt(dcx * dcx + dcy * dcy);
      if (dist < minDist) { minDist = dist; nearest = p; }
    }

    const tt  = document.getElementById('chart-tooltip');
    const cxL = e.clientX - rect.left;
    const cyL = e.clientY - rect.top;

    if (minDist < 25 && nearest) {
      let tip = `(${nearest.x.toFixed(3)}, ${nearest.y.toFixed(3)})`;
      if (this._lagrange)
        tip += `\nL(x) = ${this._lagrange.evaluate(nearest.x).toFixed(4)}`;
      if (this._lsm) {
        const pred = this._lsm.evaluate(nearest.x);
        tip += `\nŷ = ${pred.toFixed(4)}   r = ${(nearest.y - pred).toFixed(4)}`;
      }
      this._showTooltip(tt, tip, cxL + 14, cyL - 36);
    } else if (cxL > this._r.padding && cxL < rect.width - this._r.padding) {
      let tip = `x = ${mx.toFixed(3)}`;
      if (this._lagrange) tip += `\nL(x) = ${this._lagrange.evaluate(mx).toFixed(4)}`;
      if (this._lsm)      tip += `\nМНК = ${this._lsm.evaluate(mx).toFixed(4)}`;
      this._showTooltip(tt, tip, cxL + 14, cyL - 36);
    } else {
      this._hideTooltip();
    }
  }

  _showTooltip(el, text, x, y) {
    el.style.display = 'block';
    el.style.left    = x + 'px';
    el.style.top     = y + 'px';
    el.textContent   = text;
  }
  _hideTooltip() {
    document.getElementById('chart-tooltip').style.display = 'none';
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  _updateProgress(step, total) {
    const pct = total > 0 ? Math.max(0, (step + 1) / total * 100) : 0;
    document.getElementById('anim-progress').style.width = pct + '%';
    document.getElementById('progress-label').textContent = this._anim.progressLabel;
  }

  _updateMetrics() {
    document.getElementById('metric-nodes').textContent =
      `Вузлів: ${this._points.length}`;
    if (this._lsm) {
      document.getElementById('metric-degree').textContent = `Ступінь: ${this._lsm.degree}`;
      document.getElementById('metric-rmse').textContent   = `RMSE: ${this._lsm.rmse.toFixed(5)}`;
      document.getElementById('metric-r2').textContent     = `R²: ${this._lsm.r2.toFixed(5)}`;
    } else {
      document.getElementById('metric-degree').textContent = `Ступінь: ${this._points.length - 1}`;
      document.getElementById('metric-rmse').textContent   = 'RMSE: 0';
      document.getElementById('metric-r2').textContent     = 'R²: 1';
    }
  }

  _clearMetrics() {
    ['metric-rmse','metric-r2','metric-degree','metric-nodes'].forEach(id => {
      const el = document.getElementById(id);
      el.textContent = el.textContent.split(':')[0] + ': —';
    });
  }

  _updateDivDiffsTable() {
    const sec = document.getElementById('divdiffs-section');
    if (this._algo !== 'newton' || !this._newton) {
      sec.classList.add('hidden');
      return;
    }
    sec.classList.remove('hidden');
    const { xs, table, n } = this._newton.getDividedDiffsTable();
    let html = '<table class="divdiffs-html-table"><thead><tr><th>xᵢ</th><th>f[xᵢ]</th>';
    for (let j = 1; j < n; j++) html += `<th>Δ${j}</th>`;
    html += '</tr></thead><tbody>';
    for (let i = 0; i < n; i++) {
      html += `<tr><td>${xs[i].toFixed(3)}</td>`;
      for (let j = 0; j < n - i; j++) {
        const val = table[j][i];
        html += `<td>${Number.isFinite(val) ? val.toFixed(4) : '—'}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    document.getElementById('divdiffs-table').innerHTML = html;
  }

  _syncDegreeRow() {
    document.getElementById('degree-row').classList.toggle('hidden', this._algo !== 'lsm');
  }

  _setButtonsComputed(computed) {
    document.getElementById('btn-pause').disabled    = !computed;
    document.getElementById('btn-step-back').disabled = !computed;
    document.getElementById('btn-step-fwd').disabled  = !computed;
  }

  // ── Toast notifications ───────────────────────────────────────────────────

  _toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const el        = document.createElement('div');
    el.className    = `toast toast-${type}`;
    el.textContent  = msg;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast-visible'));
    setTimeout(() => {
      el.classList.remove('toast-visible');
      setTimeout(() => el.remove(), 400);
    }, 2800);
  }
}
