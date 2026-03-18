/**
 * main.js
 * Точка входу: оголошення глобальних змінних,
 * координація модулів, обробники onStart і onReset
 */

// ── Оголошення глобальних змінних ────────────────────────────
let scene, camera, renderer, controls
let trajectoryLine = null
let markerSphere   = null
let animationId    = null
let currentIndex   = 0
let pointsArray    = []

// ── Ініціалізація при завантаженні сторінки ──────────────────
window.addEventListener('load', () => {
  initScene()    // renderer.js — створення сцени, камери, рендерера, controls
  addAxes()      // renderer.js — осі X(червона) Y(зелена) Z(синя) + сітка
  bindControls() // ui.js      — прив'язка подій до форми + localStorage

  // Базовий рендер-цикл
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

  // 2. Зчитуємо параметри з форми — ui.js
  const params = readParams()

  // 3. Валідація — physics.js
  const error = validateParams(params)
  if (error) {
    showError(error)  // НІ — показуємо помилку і зупиняємось
    return
  }

  // 4. Зберігаємо параметри у localStorage
  localStorage.setItem('sim_params', JSON.stringify(params))

  // 5. Очищаємо попередню симуляцію
  resetScene()

  // 6. Обчислюємо масив точок траєкторії — physics.js
  // computeDirection викликається всередині computeTrajectory3D
  pointsArray = computeTrajectory3D(params)

  // 7. Будуємо THREE.Line у сцені — renderer.js
  buildTrajectoryLine(pointsArray, params.color)

  // 8. Створюємо сферу-маркер — renderer.js
  createMarker(params.x0, params.y0, params.z0)

  // 9. Запускаємо анімаційний цикл — renderer.js
  animateMarker(pointsArray)
}

// ── onReset — обробник кнопки "Reset" ────────────────────────
function onReset() {
  resetScene()
  showError(null)

  // Повертаємо інфо-панель до початкових значень
  const p = readParams()
  updateInfoPanel({ t: 0, x: p.x0, y: p.y0, z: p.z0, v: p.v0 })
}

// ── resetScene() — очищення сцени і скидання стану ───────────
/**
 * cancelAnimationFrame(animationId)
 * scene.remove(trajectoryLine)
 * scene.remove(markerSphere)
 * trajectoryLine = null
 * markerSphere   = null
 * currentIndex   = 0
 * pointsArray    = []
 * updateInfoPanel({ t:0, x:x0, y:y0, z:z0, v:v0 })
 */
function resetScene() {
  // Зупиняємо анімацію
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  // Видаляємо траєкторію зі сцени і звільняємо пам'ять GPU
  if (trajectoryLine) {
    scene.remove(trajectoryLine)
    trajectoryLine.geometry.dispose()
    trajectoryLine.material.dispose()
    trajectoryLine = null
  }

  // Видаляємо маркер зі сцени і звільняємо пам'ять GPU
  if (markerSphere) {
    scene.remove(markerSphere)
    markerSphere.geometry.dispose()
    markerSphere.material.dispose()
    markerSphere = null
  }

  // Скидаємо стан
  currentIndex = 0
  pointsArray  = []
}