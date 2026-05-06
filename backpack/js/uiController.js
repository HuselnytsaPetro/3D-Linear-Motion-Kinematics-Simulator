/**
 * @file uiController.js
 * @description Диригент додатку — слухає DOM-події, валідує дані,
 *              запускає солвери, керує анімацією та відображенням.
 */

'use strict';

class UIController {
    /**
     * @param {AnimationManager} animationManager
     * @param {DataStore}        dataStore
     */
    constructor(animationManager, dataStore) {
        this.anim = animationManager;
        this.store = dataStore;
        this.dpSolver = null;

        // ── DOM refs ──────────────────────────────────────────────────────────────
        this.$ = {
            n: document.getElementById('inp-n'),
            W: document.getElementById('inp-W'),
            weights: document.getElementById('inp-weights'),
            values: document.getElementById('inp-values'),
            speed: document.getElementById('speed-slider'),
            speedLabel: document.getElementById('speed-label'),

            btnRun: document.getElementById('btn-run'),
            btnReset: document.getElementById('btn-reset'),
            btnFwd: document.getElementById('btn-step-fwd'),
            btnBwd: document.getElementById('btn-step-bwd'),
            btnPause: document.getElementById('btn-pause'),

            progress: document.getElementById('anim-progress'),
            progLabel: document.getElementById('anim-step-label'),

            dpWrapper: document.getElementById('dp-table-wrapper'),
            resultContent: document.getElementById('result-content'),
            compareContent: document.getElementById('compare-content'),
            toastContainer: document.getElementById('toast-container'),
            methodInputs: document.querySelectorAll('input[name="method"]'),
        };

        this._bindEvents();
        this._restoreSession();

        // Колбеки для AnimationManager
        this.anim.onStep = (step, idx, isReverse) => this._onAnimStep(step, idx, isReverse);
        this.anim.onFinish = () => this._onAnimFinish();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT BINDING
    // ─────────────────────────────────────────────────────────────────────────

    _bindEvents() {
        const { btnRun, btnReset, btnFwd, btnBwd, btnPause, speed, speedLabel } = this.$;

        btnRun.addEventListener('click', () => this._handleRun());
        btnReset.addEventListener('click', () => this._handleReset());
        btnFwd.addEventListener('click', () => this._handleStepFwd());
        btnBwd.addEventListener('click', () => this._handleStepBwd());
        btnPause.addEventListener('click', () => this._handlePause());

        speed.addEventListener('input', () => {
            const ms = parseInt(speed.value);
            this.anim.setSpeed(ms);
            speedLabel.textContent = `${ms} мс/крок`;
        });

        // Auto-sync n ↔ weights/values placeholders
        this.$.n.addEventListener('change', () => this._syncPlaceholders());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SESSION RESTORE
    // ─────────────────────────────────────────────────────────────────────────

    _restoreSession() {
        const saved = this.store.restore();
        if (!saved) return;

        try {
            this.$.n.value = saved.n ?? 4;
            this.$.W.value = saved.capacity ?? 10;
            this.$.weights.value = (saved.weights ?? []).join(',');
            this.$.values.value = (saved.values ?? []).join(',');

            const m = saved.method ?? 4;
            const radio = document.querySelector(`input[name="method"][value="${m}"]`);
            if (radio) radio.checked = true;

            this._toast('✓ Сесію відновлено', 'info');
        } catch (e) {
            console.warn('[UIController] session restore failed:', e);
        }
    }

    _saveSession(params) {
        this.store.save(params);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INPUT PARSING & VALIDATION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Зчитати та провалідувати вхідні дані.
     * @returns {{ n, capacity, weights, values, method } | null}
     */
    _parseInputs() {
        const n = parseInt(this.$.n.value);
        const capacity = parseInt(this.$.W.value);
        const method = parseInt(document.querySelector('input[name="method"]:checked')?.value ?? 4);

        if (!Number.isInteger(n) || n < 1 || n > 15) {
            this._toast('❌ Кількість предметів: від 1 до 15', 'error'); return null;
        }
        if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) {
            this._toast('❌ Місткість рюкзака: від 1 до 50', 'error'); return null;
        }

        const parseVec = (str, label) => {
            const parts = str.split(',').map(s => parseInt(s.trim()));
            if (parts.some(isNaN)) {
                this._toast(`❌ ${label}: введіть цілі числа через кому`, 'error');
                return null;
            }
            return parts;
        };

        const weights = parseVec(this.$.weights.value, 'Ваги');
        if (!weights) return null;
        const values = parseVec(this.$.values.value, 'Цінності');
        if (!values) return null;

        if (weights.length !== n || values.length !== n) {
            this._toast(`❌ Введіть рівно ${n} ваг і ${n} цінностей`, 'error'); return null;
        }
        if (weights.some(w => w <= 0)) {
            this._toast('❌ Ваги мають бути більше 0', 'error'); return null;
        }
        if (values.some(v => v <= 0)) {
            this._toast('❌ Цінності мають бути більше 0', 'error'); return null;
        }
        if (method === 1 && n > 20) {
            this._toast('⚠️ Brute Force для n>20 може зависнути', 'warn');
        }

        return { n, capacity, weights, values, method };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLER: RUN
    // ─────────────────────────────────────────────────────────────────────────

    _handleRun() {
        const params = this._parseInputs();
        if (!params) return;

        const { n, capacity, weights, values, method } = params;
        this._saveSession(params);
        this.anim.pause();

        // Запуск усіх 5 солверів для таблиці порівняння
        const results = this._runAllSolvers(weights, values, capacity);

        // Показати таблицю порівняння
        this._renderCompareTable(results);

        // Відобразити результат обраного методу
        const chosen = results.find(r => r.methodId === method);
        if (chosen) this._renderResult(chosen, weights, values, n, capacity);

        // Завжди будуємо DP-таблицю (потрібна для анімації)
        this.dpSolver = new DPSolver(weights, values, capacity);
        this.dpSolver.solve();

        this._buildDPTable(this.dpSolver.getDPTable(), n, capacity, weights);

        // Якщо обрано DP — запустити анімацію
        if (method === 4) {
            this.anim.setStepQueue(this.dpSolver.getStepQueue());
            this._setAnimControls(true);
            this._updateProgress();
            this.anim.playAll();
            this._setPlayPauseBtn(true);
        } else {
            // Для інших методів — відразу показати фінальну DP-таблицю
            this._showFinalDPState();
            this._setAnimControls(false);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ALL SOLVERS RUNNER
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param {number[]} weights
     * @param {number[]} values
     * @param {number}   capacity
     * @returns {Array}
     */
    _runAllSolvers(weights, values, capacity) {
        const solvers = [
            { methodId: 1, name: 'Brute Force', cls: BruteForceSolver, badge: '' },
            { methodId: 2, name: 'Recursive', cls: RecursiveSolver, badge: '' },
            { methodId: 3, name: 'Greedy', cls: GreedySolver, badge: '≈' },
            { methodId: 4, name: 'DP', cls: DPSolver, badge: '★' },
            { methodId: 5, name: 'Branch & Bound', cls: BranchBoundSolver, badge: '' },
        ];

        return solvers.map(({ methodId, name, cls, badge }) => {
            const t0 = performance.now();
            const solver = new cls(weights, values, capacity);
            const result = solver.solve();
            const time = performance.now() - t0;
            return { methodId, name, badge, ...result, time };
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLER: RESET
    // ─────────────────────────────────────────────────────────────────────────

    _handleReset() {
        this.anim.reset();
        this.dpSolver = null;

        // Defaults
        this.$.n.value = '4';
        this.$.W.value = '10';
        this.$.weights.value = '2,3,4,5';
        this.$.values.value = '3,4,5,8';
        document.querySelector('input[name="method"][value="4"]').checked = true;

        this.store.clear();

        this.$.dpWrapper.innerHTML = '<p class="dp-placeholder">Натисніть «Запустити» для відображення таблиці</p>';
        this.$.resultContent.innerHTML = '<p class="placeholder-text">Результати з\'являться після запуску</p>';
        this.$.compareContent.innerHTML = '<p class="placeholder-text">Порівняння з\'явиться після запуску</p>';

        this._setAnimControls(false);
        this._updateProgress();
        this._toast('↺ Скинуто до налаштувань за замовчуванням', 'info');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLER: STEP FWD / BWD / PAUSE
    // ─────────────────────────────────────────────────────────────────────────

    _handleStepFwd() {
        this.anim.pause();
        this.anim.nextStep();
        this._updateProgress();
        this._setPlayPauseBtn(false);
        this._updateStepBtns();
    }

    _handleStepBwd() {
        this.anim.pause();
        this.anim.prevStep();
        this._updateProgress();
        this._setPlayPauseBtn(false);
        this._updateStepBtns();
    }

    _handlePause() {
        if (this.anim.isPlaying) {
            this.anim.pause();
            this._setPlayPauseBtn(false);
        } else {
            this.anim.playAll();
            this._setPlayPauseBtn(true);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ANIMATION CALLBACKS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Викликається для кожного кроку анімації.
     * @param {{i,w,value,took}} step
     * @param {number}  index
     * @param {boolean} isReverse
     */
    _onAnimStep(step, index, isReverse) {
        const { i, w, value, took } = step;

        // Зняти попередній активний клас
        document.querySelectorAll('.cell-active').forEach(el => {
            el.classList.remove('cell-active');
        });

        const cell = document.getElementById(`dp-cell-${i}-${w}`);
        if (!cell) return;

        // Встановити значення
        cell.textContent = value;

        if (!isReverse) {
            cell.classList.add('cell-computed');
            cell.classList.add('cell-active');
            if (took) {
                cell.classList.add('cell-took');
            }
        } else {
            // При відмотуванні — очистити клітинку
            cell.textContent = '';
            cell.classList.remove('cell-computed', 'cell-active', 'cell-took', 'cell-optimal');
        }

        this._updateProgress();
        this._updateStepBtns();
    }

    _onAnimFinish() {
        this.anim.isPlaying = false;
        this._setPlayPauseBtn(false);
        this._updateProgress();
        this._updateStepBtns();
        this._highlightOptimalPath();
        this._toast('✓ Анімацію завершено', 'success');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DP TABLE RENDERING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Побудувати HTML-таблицю dp[i][w] (порожні клітинки — заповнюються анімацією).
     * @param {number[][]} dp
     * @param {number}     n
     * @param {number}     W
     * @param {number[]}   weights
     */
    _buildDPTable(dp, n, W, weights) {
        const wrapper = this.$.dpWrapper;
        wrapper.innerHTML = '';

        const table = document.createElement('table');
        table.className = 'dp-table';

        // Header row: w = 0..W
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
        const th0 = document.createElement('th');
        th0.textContent = 'i \\ w';
        th0.className = 'dp-header-corner';
        headerRow.appendChild(th0);

        for (let w = 0; w <= W; w++) {
            const th = document.createElement('th');
            th.textContent = w;
            th.className = 'dp-header';
            headerRow.appendChild(th);
        }

        // Body rows: i = 0..n
        const tbody = table.createTBody();
        for (let i = 0; i <= n; i++) {
            const tr = tbody.insertRow();

            // Row header
            const rowTh = document.createElement('th');
            rowTh.className = 'dp-row-header';
            if (i === 0) {
                rowTh.textContent = '0';
                rowTh.title = 'Базовий рядок (без предметів)';
            } else {
                rowTh.innerHTML = `${i}<span class="row-weight">(w${i}=${weights[i - 1]})</span>`;
                rowTh.title = `Предмет ${i}, вага=${weights[i - 1]}`;
            }
            tr.appendChild(rowTh);

            for (let w = 0; w <= W; w++) {
                const td = document.createElement('td');
                td.id = `dp-cell-${i}-${w}`;
                td.className = 'dp-cell';

                // Рядок i=0 відразу заповнений нулями
                if (i === 0) {
                    td.textContent = '0';
                    td.classList.add('cell-computed', 'cell-base');
                }

                tr.appendChild(td);
            }
        }

        wrapper.appendChild(table);
    }

    /** Показати фінальний стан DP-таблиці без анімації. */
    _showFinalDPState() {
        if (!this.dpSolver) return;
        const dp = this.dpSolver.getDPTable();
        const queue = this.dpSolver.getStepQueue();

        queue.forEach(({ i, w, value, took }) => {
            const cell = document.getElementById(`dp-cell-${i}-${w}`);
            if (!cell) return;
            cell.textContent = value;
            cell.classList.add('cell-computed');
            if (took) cell.classList.add('cell-took');
        });

        this._highlightOptimalPath();
    }

    /** Підсвітити оптимальний шлях (backtrack) у таблиці. */
    _highlightOptimalPath() {
        if (!this.dpSolver) return;
        const optimal = this.dpSolver.getOptimalCells();
        optimal.forEach(key => {
            const [i, w] = key.split('-');
            const cell = document.getElementById(`dp-cell-${i}-${w}`);
            if (cell) {
                cell.classList.add('cell-optimal');
                cell.classList.remove('cell-active');
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RESULT PANEL
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param {{ maxValue, selectedItems, totalWeight, isApproximate, name, badge }} result
     * @param {number[]} weights
     * @param {number[]} values
     * @param {number}   n
     * @param {number}   capacity
     */
    _renderResult(result, weights, values, n, capacity) {
        const { maxValue, selectedItems, totalWeight, isApproximate, name, badge } = result;
        const sorted = [...selectedItems].sort((a, b) => a - b);

        const itemsHtml = sorted.map(i => `
      <div class="item-chip">
        <span class="item-idx">Предмет ${i + 1}</span>
        <span class="item-w">w=${weights[i]}</span>
        <span class="item-v">v=${values[i]}</span>
      </div>
    `).join('');

        const approxWarn = isApproximate
            ? '<div class="warn-badge">⚠️ Жадібний алгоритм не гарантує оптимум для 0/1 задачі</div>'
            : '';

        this.$.resultContent.innerHTML = `
      <div class="result-method-badge">${name} ${badge}</div>
      <div class="result-value-big">${maxValue}</div>
      <div class="result-label">Максимальна цінність</div>
      <div class="result-weight-bar">
        <div class="result-weight-fill" style="width:${Math.min(100, (totalWeight / capacity) * 100)}%"></div>
      </div>
      <div class="result-weight-text">Вага: <b>${totalWeight}</b> / ${capacity}</div>
      <div class="result-items-label">Вибрані предмети (${sorted.length}):</div>
      <div class="result-items">${itemsHtml || '<span class="muted">Жоден предмет не обрано</span>'}</div>
      ${approxWarn}
    `;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // COMPARE TABLE
    // ─────────────────────────────────────────────────────────────────────────

    /** @param {Array} results */
    _renderCompareTable(results) {
        const maxVal = Math.max(...results.map(r => r.maxValue));

        const rows = results.map(r => {
            const isOpt = r.maxValue === maxVal;
            const isBest = isOpt && r.time === Math.min(...results.filter(x => x.maxValue === maxVal).map(x => x.time));
            return `
        <tr class="${r.methodId === 4 ? 'row-dp' : ''} ${isOpt ? 'row-optimal' : ''}">
          <td class="col-method">
            <span class="method-badge badge-m${r.methodId}">M${r.methodId}</span>
            ${r.name} ${r.badge}
          </td>
          <td class="col-value ${isOpt ? 'value-opt' : ''}">${r.maxValue}</td>
          <td class="col-time ${isBest ? 'time-best' : ''}">${r.time.toFixed(2)} мс</td>
        </tr>
      `;
        }).join('');

        this.$.compareContent.innerHTML = `
      <table class="compare-table">
        <thead>
          <tr>
            <th>Метод</th>
            <th>Цінність</th>
            <th>Час (мс)</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UI STATE HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    _setAnimControls(enabled) {
        this.$.btnFwd.disabled = !enabled;
        this.$.btnBwd.disabled = !enabled;
        this.$.btnPause.disabled = !enabled;
        this.$.progress.classList.toggle('hidden', !enabled);
    }

    _setPlayPauseBtn(isPlaying) {
        this.$.btnPause.textContent = isPlaying ? '⏸ Пауза' : '▶ Далі';
    }

    _updateProgress() {
        if (this.anim.totalSteps === 0) {
            this.$.progLabel.textContent = '';
            return;
        }
        this.$.progLabel.textContent = this.anim.progressLabel;
        const pct = ((this.anim.currentStep + 1) / this.anim.totalSteps) * 100;
        document.documentElement.style.setProperty('--anim-pct', `${pct}%`);
    }

    _updateStepBtns() {
        this.$.btnBwd.disabled = this.anim.currentStep < 0;
        this.$.btnFwd.disabled = this.anim.isFinished;
    }

    _syncPlaceholders() {
        const n = parseInt(this.$.n.value) || 4;
        const arr = i => Array.from({ length: n }, (_, j) => i + j + 1).join(',');
        this.$.weights.placeholder = arr(1);
        this.$.values.placeholder = arr(2);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TOAST NOTIFICATIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param {string} msg
     * @param {'info'|'success'|'error'|'warn'} type
     */
    _toast(msg, type = 'info') {
        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        el.textContent = msg;
        this.$.toastContainer.appendChild(el);
        requestAnimationFrame(() => el.classList.add('toast-show'));
        setTimeout(() => {
            el.classList.remove('toast-show');
            setTimeout(() => el.remove(), 400);
        }, 3000);
    }
}