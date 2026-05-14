'use strict';
/**
 * @file animationManager.js
 * @description Controls step-by-step and continuous animation for
 * interpolation (node-by-node) and LSM (frame-by-frame polynomial growth).
 */

class AnimationManager {
  constructor() {
    this.mode        = 'interp';  // 'interp' | 'lsm'
    this.totalSteps  = 0;
    this.currentStep = -1;
    this.isPlaying   = false;
    this.speed       = 500;   // ms per step
    this._timer      = null;

    /** Called on every step change: (step:number, total:number) => void */
    this.onStep     = null;
    /** Called when playback finishes. */
    this.onFinish   = null;
    /** Called on every step for progress bar update. */
    this.onProgress = null;
  }

  // ── Setup ─────────────────────────────────────────────────────────────────

  /** Configure for interpolation animation (steps = 1 … nodeCount). */
  setupInterpolation(nodeCount) {
    this._configure('interp', nodeCount);
  }

  /** Configure for LSM animation (steps = number of coefficient frames). */
  setupLSM(frames) {
    this._configure('lsm', frames);
  }

  _configure(mode, steps) {
    this.mode        = mode;
    this.totalSteps  = steps;
    this.currentStep = -1;
    this.isPlaying   = false;
    this._clearTimer();
    this._notifyProgress();
  }

  // ── Controls ──────────────────────────────────────────────────────────────

  setSpeed(ms) { this.speed = Math.max(50, Math.min(2000, ms)); }

  /** Advance one step. Returns false if already at end. */
  nextStep() {
    if (this.currentStep >= this.totalSteps - 1) return false;
    this.currentStep++;
    this._notifyStep();
    return this.currentStep < this.totalSteps - 1;
  }

  /** Go back one step. Returns false if already at start. */
  prevStep() {
    if (this.currentStep <= 0) return false;
    this.currentStep--;
    this._notifyStep();
    return true;
  }

  /** Start automatic playback. */
  playAll() {
    if (this.isPlaying) return;
    // Restart from beginning if already finished
    if (this.currentStep >= this.totalSteps - 1) this.currentStep = -1;
    this.isPlaying = true;
    this._scheduleNext();
  }

  /** Pause automatic playback. */
  pause() {
    this.isPlaying = false;
    this._clearTimer();
  }

  /** Reset to before-first-step state. */
  reset() {
    this.pause();
    this.currentStep = -1;
    this._notifyProgress();
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  /** Playback progress 0→1. */
  get progressPct() {
    if (this.totalSteps <= 0) return 0;
    return Math.max(0, (this.currentStep + 1) / this.totalSteps);
  }

  get progressLabel() {
    const s = Math.max(0, this.currentStep + 1);
    const t = this.totalSteps;
    return this.mode === 'lsm'
      ? `Кадр ${s} / ${t}`
      : `Вузол ${s} / ${t}`;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _scheduleNext() {
    if (!this.isPlaying) return;
    this._clearTimer();
    this._timer = setTimeout(() => {
      const hasMore = this.nextStep();
      if (hasMore && this.isPlaying) {
        this._scheduleNext();
      } else {
        this.isPlaying = false;
        if (this.onFinish) this.onFinish();
      }
    }, this.speed);
  }

  _clearTimer() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }

  _notifyStep() {
    this._notifyProgress();
    if (this.onStep) this.onStep(this.currentStep, this.totalSteps);
  }

  _notifyProgress() {
    if (this.onProgress) this.onProgress(this.currentStep, this.totalSteps);
  }
}
