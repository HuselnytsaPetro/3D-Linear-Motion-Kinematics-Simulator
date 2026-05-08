/**
 * @file main.js
 * @description Точка входу — ініціалізація та «зшивання» всіх компонентів.
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const dataStore = new DataStore();
    const animationManager = new AnimationManager();
    const uiController = new UIController(animationManager, dataStore);

    // Доступні глобально для налагодження
    window.__knapsack = { dataStore, animationManager, uiController };

    console.info('[KnapsackSim] Ініціалізовано. Версія 1.0.0');
});
