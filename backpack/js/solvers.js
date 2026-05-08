/**
 * @file solvers.js
 * @description Knapsack Problem — 5 алгоритмів розв'язання.
 * Ієрархія: KnapsackSolver (абстрактний) → M1–M5 конкретні солвери.
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// BASE CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Абстрактний базовий клас для всіх солверів задачі «Рюкзак».
 */
class KnapsackSolver {
    /**
     * @param {number[]} weights  Ваги предметів
     * @param {number[]} values   Цінності предметів
     * @param {number}   capacity Максимальна місткість рюкзака W
     */
    constructor(weights, values, capacity) {
        this.weights = weights;
        this.values = values;
        this.capacity = capacity;
        this.n = weights.length;
        this.result = null;
    }

    /** @abstract Запуск алгоритму */
    solve() { throw new Error('solve() must be implemented by subclass'); }

    /** @returns {{ maxValue, selectedItems, totalWeight }} */
    getResult() { return this.result; }
}

// ─────────────────────────────────────────────────────────────────────────────
// M1 — BRUTE FORCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Метод 1: Повний перебір (Brute Force).
 * Генерує всі 2ⁿ підмножини предметів через бітові маски.
 * Складність: O(2ⁿ · n).
 */
class BruteForceSolver extends KnapsackSolver {
    solve() {
        const { weights, values, capacity, n } = this;
        let maxVal = 0;
        let bestMask = 0;

        for (let mask = 0; mask < (1 << n); mask++) {
            let totalW = 0;
            let totalV = 0;
            for (let i = 0; i < n; i++) {
                if (mask & (1 << i)) {
                    totalW += weights[i];
                    totalV += values[i];
                }
            }
            if (totalW <= capacity && totalV > maxVal) {
                maxVal = totalV;
                bestMask = mask;
            }
        }

        const selectedItems = [];
        for (let i = 0; i < n; i++) {
            if (bestMask & (1 << i)) selectedItems.push(i);
        }

        const totalWeight = selectedItems.reduce((s, i) => s + weights[i], 0);
        this.result = { maxValue: maxVal, selectedItems, totalWeight };
        return this.result;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// M2 — RECURSIVE + MEMOIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Метод 2: Рекурсія з мемоізацією.
 * Функція solve(i, w) зберігає підзадачі в memo[i][w].
 * Складність: O(n · W).
 */
class RecursiveSolver extends KnapsackSolver {
    solve() {
        const { weights, values, capacity, n } = this;
        /** @type {number[][]} */
        this.memo = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(-1));

        const rec = (i, w) => {
            if (i === 0 || w === 0) return 0;
            if (this.memo[i][w] !== -1) return this.memo[i][w];

            const noTake = rec(i - 1, w);
            const take = weights[i - 1] <= w
                ? values[i - 1] + rec(i - 1, w - weights[i - 1])
                : -Infinity;

            this.memo[i][w] = Math.max(noTake, take);
            return this.memo[i][w];
        };

        const maxValue = rec(n, capacity);

        // Відновлення шляху через memo
        const selectedItems = [];
        let w = capacity;
        for (let i = n; i > 0; i--) {
            if (this.memo[i][w] !== this.memo[i - 1]?.[w]) {
                selectedItems.push(i - 1);
                w -= weights[i - 1];
            }
        }

        const totalWeight = selectedItems.reduce((s, i) => s + weights[i], 0);
        this.result = { maxValue, selectedItems, totalWeight };
        return this.result;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// M4 — DYNAMIC PROGRAMMING ★ (головний метод)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Метод 4: Динамічне програмування.
 * Будує таблицю dp[i][w] (знизу вгору), відновлює рішення через backtrack.
 * Також генерує stepQueue[] для покрокової анімації.
 * Складність: O(n · W) час і пам'ять.
 */
class DPSolver extends KnapsackSolver {
    solve() {
        const { weights, values, capacity, n } = this;

        // Ініціалізація таблиці dp[n+1][W+1]
        this.dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));

        /** @type {Array<{i,w,value,took}>} Черга кроків для анімації */
        this.stepQueue = [];

        // Заповнення таблиці
        for (let i = 1; i <= n; i++) {
            for (let w = 0; w <= capacity; w++) {
                const noTake = this.dp[i - 1][w];
                let take = -Infinity;

                if (weights[i - 1] <= w) {
                    take = values[i - 1] + this.dp[i - 1][w - weights[i - 1]];
                }

                this.dp[i][w] = Math.max(noTake, take < 0 ? noTake : take);
                const tookItem = take !== -Infinity && take > noTake;

                this.stepQueue.push({ i, w, value: this.dp[i][w], took: tookItem });
            }
        }

        // Відновлення оптимального шляху (backtrack)
        const selectedItems = [];
        const optimalCells = new Set();
        let w = capacity;

        optimalCells.add(`${n}-${w}`);
        for (let i = n; i > 0; i--) {
            if (this.dp[i][w] !== this.dp[i - 1][w]) {
                selectedItems.push(i - 1);
                w -= weights[i - 1];
            }
            optimalCells.add(`${i - 1}-${w}`);
        }

        const totalWeight = selectedItems.reduce((s, i) => s + weights[i], 0);
        const maxValue = this.dp[n][capacity];

        this.optimalCells = optimalCells;
        this.result = { maxValue, selectedItems, totalWeight };
        return this.result;
    }

    /** @returns {Array<{i,w,value,took}>} */
    getStepQueue() { return this.stepQueue; }

    /** @returns {number[][]} */
    getDPTable() { return this.dp; }

    /** @returns {Set<string>} набір ключів "i-w" оптимального шляху */
    getOptimalCells() { return this.optimalCells; }
}

// ─────────────────────────────────────────────────────────────────────────────
// M3 — GREEDY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Метод 3: Жадібний алгоритм.
 * Сортує предмети за спаданням питомої цінності v[i]/w[i].
 * Не гарантує глобальний оптимум для 0/1 Рюкзака.
 * Складність: O(n log n).
 */
class GreedySolver extends KnapsackSolver {
    solve() {
        const { weights, values, capacity, n } = this;

        const items = Array.from({ length: n }, (_, i) => ({
            index: i,
            ratio: values[i] / weights[i],
        })).sort((a, b) => b.ratio - a.ratio);

        let totalW = 0;
        let totalV = 0;
        const selectedItems = [];

        for (const { index } of items) {
            if (totalW + weights[index] <= capacity) {
                selectedItems.push(index);
                totalW += weights[index];
                totalV += values[index];
            }
        }

        this.result = {
            maxValue: totalV,
            selectedItems,
            totalWeight: totalW,
            isApproximate: true,
        };
        return this.result;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// M5 — BRANCH & BOUND
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Метод 5: Метод гілок і меж.
 * DFS із відсіченням гілок через верхню оцінку (дробовий рюкзак).
 * Складність: в гіршому випадку O(2ⁿ), на практиці значно краще.
 */
class BranchBoundSolver extends KnapsackSolver {
    solve() {
        const { weights, values, capacity, n } = this;

        // Сортування за питомою цінністю для кращих відсічень
        const items = Array.from({ length: n }, (_, i) => ({
            index: i,
            w: weights[i],
            v: values[i],
            ratio: values[i] / weights[i],
        })).sort((a, b) => b.ratio - a.ratio);

        /**
         * Верхня оцінка: жадібний дробовий рюкзак від рівня level.
         * @param {number} level
         * @param {number} currentW
         * @param {number} currentV
         * @returns {number}
         */
        const upperBound = (level, currentW, currentV) => {
            let bound = currentV;
            let remainW = capacity - currentW;

            for (let j = level; j < n && remainW > 0; j++) {
                if (items[j].w <= remainW) {
                    bound += items[j].v;
                    remainW -= items[j].w;
                } else {
                    bound += items[j].ratio * remainW;
                    remainW = 0;
                }
            }
            return bound;
        };

        let maxVal = 0;
        let bestSet = [];

        /**
         * Рекурсивний DFS з відсіченням.
         * @param {number}   level      Поточний рівень дерева рішень
         * @param {number}   currentW   Поточна вага
         * @param {number}   currentV   Поточна цінність
         * @param {number[]} currentSet Поточний набір індексів
         */
        const dfs = (level, currentW, currentV, currentSet) => {
            if (currentV > maxVal) {
                maxVal = currentV;
                bestSet = [...currentSet];
            }
            if (level >= n) return;

            // Гілка «взяти»
            if (currentW + items[level].w <= capacity) {
                const ub = upperBound(level + 1, currentW + items[level].w, currentV + items[level].v);
                if (ub > maxVal) {
                    dfs(
                        level + 1,
                        currentW + items[level].w,
                        currentV + items[level].v,
                        [...currentSet, items[level].index]
                    );
                }
            }

            // Гілка «не взяти»
            const ub = upperBound(level + 1, currentW, currentV);
            if (ub > maxVal) {
                dfs(level + 1, currentW, currentV, currentSet);
            }
        };

        dfs(0, 0, 0, []);

        const selectedItems = bestSet;
        const totalWeight = selectedItems.reduce((s, i) => s + weights[i], 0);

        this.result = { maxValue: maxVal, selectedItems, totalWeight };
        return this.result;
    }
}