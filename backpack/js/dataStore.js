/**
 * @file dataStore.js
 * @description Збереження та відновлення параметрів сеансу через localStorage.
 */

'use strict';

class DataStore {
    static KEY = 'knapsack_simulator_v1';

    /**
     * Зберегти параметри сеансу.
     * @param {{ n, capacity, weights, values, method }} params
     */
    save(params) {
        try {
            localStorage.setItem(DataStore.KEY, JSON.stringify(params));
        } catch (e) {
            console.warn('[DataStore] save failed:', e.message);
        }
    }

    /**
     * Відновити параметри збереженого сеансу.
     * @returns {{ n, capacity, weights, values, method } | null}
     */
    restore() {
        try {
            const raw = localStorage.getItem(DataStore.KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.warn('[DataStore] restore failed:', e.message);
            return null;
        }
    }

    /** Очистити збережені дані. */
    clear() {
        try {
            localStorage.removeItem(DataStore.KEY);
        } catch (e) {
            console.warn('[DataStore] clear failed:', e.message);
        }
    }
}