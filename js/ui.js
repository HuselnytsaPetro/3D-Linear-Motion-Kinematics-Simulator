/**
 * ui.js
 * Інтерфейс: зчитування параметрів, відображення інфо-панелі та аналітики.
 *
 * Зміни відносно попередньої версії (Лаб 2.1):
 *  - Параметр 'a' (загальне прискорення) замінено на 'g' (гравітація, лише Y).
 *  - Параметр 'phi' (кут підйому) замінено на 'alpha' (кут кидання до горизонту).
 *  - Параметр 'T' (час симуляції) видалено — тепер T_flight обчислюється автоматично.
 *  - До інфо-панелі додано відображення vᵧ(t) — вертикальної складової швидкості.
 *  - Додано функцію updateAnalyticsPanel() для відображення H, R, T_flight.
 *  - LocalStorage оновлено під новий набір параметрів.
 */

/**
 * Прив'язує обробники подій до кнопок та відновлює localStorage
 */
function bindControls() {
  document.getElementById('btn-start').addEventListener('click', onStart)
  document.getElementById('btn-reset').addEventListener('click', onReset)
  document.getElementById('btn-clear').addEventListener('click', onClearScene)

  // Відновлення параметрів із localStorage
  const saved = localStorage.getItem('sim_params')
  if (saved) {
    try {
      const p = JSON.parse(saved)
      if (p.x0 !== undefined) document.getElementById('inp-x0').value = p.x0
      if (p.y0 !== undefined) document.getElementById('inp-y0').value = p.y0
      if (p.z0 !== undefined) document.getElementById('inp-z0').value = p.z0
      if (p.alpha !== undefined) document.getElementById('inp-alpha').value = p.alpha
      if (p.theta !== undefined) document.getElementById('inp-theta').value = p.theta
      if (p.v0 !== undefined) document.getElementById('inp-v0').value = p.v0
      if (p.g !== undefined) document.getElementById('inp-g').value = p.g
      if (p.color !== undefined) document.getElementById('color-picker').value = p.color
    } catch (e) {
      // Ігноруємо некоректні збережені дані
    }
  }
}

/**
 * Зчитує параметри з форми та повертає об'єкт params.
 * @returns {{ x0, y0, z0, alpha, theta, v0, g, color }}
 */
function readParams() {
  return {
    x0: parseFloat(document.getElementById('inp-x0').value) || 0,
    y0: parseFloat(document.getElementById('inp-y0').value) || 0,
    z0: parseFloat(document.getElementById('inp-z0').value) || 0,
    alpha: parseFloat(document.getElementById('inp-alpha').value) || 45,
    theta: parseFloat(document.getElementById('inp-theta').value) || 0,
    v0: parseFloat(document.getElementById('inp-v0').value) || 30,
    g: parseFloat(document.getElementById('inp-g').value) || 9.81,
    color: document.getElementById('color-picker').value || '#00aaff'
  }
}

/**
 * Відображає або приховує повідомлення про помилку
 * @param {string|null} msg
 */
function showError(msg) {
  document.getElementById('error-msg').textContent = msg || ''
}

/**
 * Оновлює числові значення в реальному часі (інфо-панель).
 * @param {{ t, x, y, z, v, vy }} pt
 */
function updateInfoPanel(pt) {
  document.getElementById('span-t').textContent = pt.t.toFixed(2)
  document.getElementById('span-x').textContent = pt.x.toFixed(3)
  document.getElementById('span-y').textContent = pt.y.toFixed(3)
  document.getElementById('span-z').textContent = pt.z.toFixed(3)
  document.getElementById('span-v').textContent = pt.v.toFixed(3)
  document.getElementById('span-vy').textContent = (pt.vy !== undefined ? pt.vy : 0).toFixed(3)
}

/**
 * Оновлює панель аналітичних показників (H, R, T_flight).
 * @param {{ H, R, Tflight }} analytics
 */
function updateAnalyticsPanel({ H, R, Tflight }) {
  document.getElementById('span-H').textContent = H.toFixed(2)
  document.getElementById('span-R').textContent = R.toFixed(2)
  document.getElementById('span-Tflight').textContent = Tflight.toFixed(2)
}