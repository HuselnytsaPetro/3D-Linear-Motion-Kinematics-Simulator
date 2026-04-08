/**
 * main.js
 * Точка входу: координація модулів, обробники onStart, onReset, onClearScene.
 *
 * Зміни відносно попередньої версії (Лаб 2.1):
 *  - onStart() більше НЕ викликає resetScene() перед кожним запуском —
 *    кожна нова симуляція накопичується на сцені поверх попередніх.
 *  - Додано обробник onClearScene() для кнопки "Очистити сцену",
 *    яка викликає clearAllTrajectories() з renderer.js.
 *  - Після обчислення траєкторії викликається updateAnalyticsPanel()
 *    з аналітичними показниками H, R, T_flight.
 *  - updateInfoPanel отримує { vy } з точок нового computeTrajectory3D.
 */

// ── Оголошення глобальних змінних ────────────────────────────
let scene, camera, renderer, controls
let trajectoryLine = null
let markerSphere = null
let animationId = null
let currentIndex = 0
let pointsArray = []

// ── Ініціалізація при завантаженні сторінки ──────────────────
window.addEventListener('load', () => {
  initScene()    // renderer.js
  addAxes()      // renderer.js
  bindControls() // ui.js

  // Базовий рендер-цикл (поки немає анімації маркера)
  function baseLoop() {
    controls.update()
    renderer.render(scene, camera)
    requestAnimationFrame(baseLoop)
  }
  baseLoop()
})

// ── onStart — обробник кнопки "Запустити" ────────────────────
function onStart() {
  // 1. Очищаємо попереднє повідомлення про помилку
  showError(null)

  // 2. Зчитуємо параметри з форми
  const params = readParams()

  // 3. Валідація
  const error = validateParams(params)
  if (error) {
    showError(error)
    return
  }

  // 4. Зберігаємо параметри у localStorage
  localStorage.setItem('sim_params', JSON.stringify(params))

  // 5. Зупиняємо попередню анімацію маркера (але НЕ видаляємо траєкторію!)
  //    clearScene() тепер лише зупиняє requestAnimationFrame.
  clearScene()

  // 6. Обчислюємо масив точок балістичної траєкторії
  pointsArray = computeTrajectory3D(params)

  // 7. Обчислюємо та відображаємо аналітичні показники
  const analytics = computeAnalytics(params)
  updateAnalyticsPanel(analytics)

  // 8. Будуємо нову THREE.Line (додається до allTrajectories[])
  buildTrajectoryLine(pointsArray, params.color)

  // 9. Створюємо новий маркер (додається до allMarkers[])
  createMarker(params.x0, params.y0, params.z0)

  // 10. Запускаємо анімацію нового маркера
  animateMarker(pointsArray)
}

// ── onReset — скидає лише форму та інфо-панель ───────────────
function onReset() {
  showError(null)
  const p = readParams()
  updateInfoPanel({ t: 0, x: p.x0, y: p.y0, z: p.z0, v: p.v0, vy: p.v0 * Math.sin(p.alpha * Math.PI / 180) })
  updateAnalyticsPanel({ H: 0, R: 0, Tflight: 0 })
}

// ── onClearScene — видаляє ВСІ траєкторії та маркери зі сцени
function onClearScene() {
  clearAllTrajectories()  // renderer.js
  showError(null)
  updateInfoPanel({ t: 0, x: 0, y: 0, z: 0, v: 0, vy: 0 })
  updateAnalyticsPanel({ H: 0, R: 0, Tflight: 0 })
  currentIndex = 0
  pointsArray = []
}

// ── resetScene() — залишено для зворотної сумісності ─────────
function resetScene() {
  clearScene()
  currentIndex = 0
  pointsArray = []
}
