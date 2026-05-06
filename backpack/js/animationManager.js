/**
 * @file animationManager.js
 * @description Керування покроковою анімацією заповнення таблиці dp[i][w].
 * Підтримує: nextStep(), prevStep(), playAll(), pause(), reset().
 */

'use strict';

class AnimationManager {
    /**
     * @param {Function} onStep    Колбек при кожному кроці: (step, index, isReverse) => void
     * @param {Function} onFinish  Колбек після завершення анімації
     */
    constructor(onStep, onFinish) {
        /** @type {Array<{i,w,value,took}>} */
        this.stepQueue = [];
        this.currentStep = -1;
        this.isPlaying = false;
        this.timer = null;
        this.speed = 150; // мс між кроками

        this.onStep = onStep || (() => { });
        this.onFinish = onFinish || (() => { });
    }

    /**
     * Завантажити нову чергу кроків і скинути стан.
     * @param {Array<{i,w,value,took}>} queue
     */
    setStepQueue(queue) {
        this.pause();
        this.stepQueue = queue;
        this.currentStep = -1;
    }

    /**
     * Встановити швидкість анімації.
     * @param {number} ms Мілісекунди між кроками (10–1000)
     */
    setSpeed(ms) {
        this.speed = Math.max(10, Math.min(1000, ms));
    }

    /** @returns {number} Кількість кроків у черзі */
    get totalSteps() { return this.stepQueue.length; }

    /** Крок уперед. @returns {boolean} true якщо крок виконано */
    nextStep() {
        if (this.currentStep >= this.totalSteps - 1) {
            this.isPlaying = false;
            this.onFinish();
            return false;
        }
        this.currentStep++;
        this.onStep(this.stepQueue[this.currentStep], this.currentStep, false);
        return true;
    }

    /** Крок назад. @returns {boolean} true якщо крок виконано */
    prevStep() {
        if (this.currentStep < 0) return false;
        this.onStep(this.stepQueue[this.currentStep], this.currentStep, true);
        this.currentStep--;
        return true;
    }

    /** Автоматичне відтворення всієї анімації. */
    playAll() {
        if (this.isPlaying) return;
        this.isPlaying = true;

        const tick = () => {
            if (!this.isPlaying) return;
            if (!this.nextStep()) {
                this.isPlaying = false;
                return;
            }
            this.timer = setTimeout(tick, this.speed);
        };
        tick();
    }

    /** Пауза відтворення. */
    pause() {
        this.isPlaying = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    /** Повне скидання стану. */
    reset() {
        this.pause();
        this.stepQueue = [];
        this.currentStep = -1;
    }

    /** @returns {boolean} */
    get hasStarted() { return this.currentStep >= 0; }
    /** @returns {boolean} */
    get isFinished() { return this.currentStep >= this.totalSteps - 1; }
    /** @returns {string} Прогрес для відображення */
    get progressLabel() {
        if (this.totalSteps === 0) return '';
        return `Крок ${this.currentStep + 1} / ${this.totalSteps}`;
    }
}