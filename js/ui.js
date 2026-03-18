/**
 * ui.js
 * Інтерфейс: прив'язка подій, зчитування форми, інфо-панель, помилки
 */

/**
 * bindControls()
 * Прив'язка обробників подій до полів форми
 * btnStart.addEventListener('click', onStart)
 * btnReset.addEventListener('click', onReset)
 * colorPicker.addEventListener('input', onColorChange)
 * Зчитування збережених params з localStorage
 */
function bindControls() {
  document.getElementById('btn-start').addEventListener('click', onStart)
  document.getElementById('btn-reset').addEventListener('click', onReset)
  document.getElementById('color-picker').addEventListener('input', onColorChange)

  // Зчитування збережених params з localStorage
  const saved = localStorage.getItem('sim_params')
  if (saved) {
    try {
      const p = JSON.parse(saved)
      if (p.x0    !== undefined) document.getElementById('inp-x0').value    = p.x0
      if (p.y0    !== undefined) document.getElementById('inp-y0').value    = p.y0
      if (p.z0    !== undefined) document.getElementById('inp-z0').value    = p.z0
      if (p.theta !== undefined) document.getElementById('inp-theta').value = p.theta
      if (p.phi   !== undefined) document.getElementById('inp-phi').value   = p.phi
      if (p.v0    !== undefined) document.getElementById('inp-v0').value    = p.v0
      if (p.a     !== undefined) document.getElementById('inp-a').value     = p.a
      if (p.T     !== undefined) document.getElementById('inp-T').value     = p.T
      if (p.color !== undefined) document.getElementById('color-picker').value = p.color
    } catch (e) {
      console.warn('Не вдалося завантажити збережені параметри:', e)
    }
  }
}

/**
 * readParams()
 * Зчитує всі параметри з полів форми
 * x0    = parseFloat(inp_x0.value)
 * y0    = parseFloat(inp_y0.value)
 * z0    = parseFloat(inp_z0.value)
 * theta = parseFloat(inp_theta.value)  // кут азимуту θ [°]
 * phi   = parseFloat(inp_phi.value)    // кут підйому φ [°]
 * v0    = parseFloat(inp_v0.value)     // початкова швидкість [м/с]
 * a     = parseFloat(inp_a.value)      // прискорення [м/с²]
 * T     = parseFloat(inp_T.value)      // тривалість [с]
 * color = colorPicker.value
 * @returns {object} params
 */
function readParams() {
  return {
    x0:    parseFloat(document.getElementById('inp-x0').value)    || 0,
    y0:    parseFloat(document.getElementById('inp-y0').value)    || 0,
    z0:    parseFloat(document.getElementById('inp-z0').value)    || 0,
    theta: parseFloat(document.getElementById('inp-theta').value) || 0,
    phi:   parseFloat(document.getElementById('inp-phi').value)   || 0,
    v0:    parseFloat(document.getElementById('inp-v0').value)    || 0,
    a:     parseFloat(document.getElementById('inp-a').value)     || 0,
    T:     parseFloat(document.getElementById('inp-T').value)     || 10,
    color: document.getElementById('color-picker').value
  }
}

/**
 * showError(msg)
 * Виведення повідомлення про помилку
 * errorDiv.textContent = msg
 * @param {string|null} msg
 */
function showError(msg) {
  document.getElementById('error-msg').textContent = msg || ''
}

/**
 * updateInfoPanel(pt)
 * Оновлює інфо-панель поточними значеннями точки
 * spanT.textContent = pt.t.toFixed(2) + ' с'
 * spanX.textContent = pt.x.toFixed(3) + ' м'
 * spanY.textContent = pt.y.toFixed(3) + ' м'
 * spanZ.textContent = pt.z.toFixed(3) + ' м'
 * spanV.textContent = pt.v.toFixed(3) + ' м/с'
 * @param {{ t, x, y, z, v }} pt
 */
function updateInfoPanel(pt) {
  document.getElementById('span-t').textContent = pt.t.toFixed(2) + ' с'
  document.getElementById('span-x').textContent = pt.x.toFixed(3) + ' м'
  document.getElementById('span-y').textContent = pt.y.toFixed(3) + ' м'
  document.getElementById('span-z').textContent = pt.z.toFixed(3) + ' м'
  document.getElementById('span-v').textContent = pt.v.toFixed(3) + ' м/с'
}

/**
 * onColorChange()
 * Змінює колір існуючої траєкторії без перезапуску симуляції
 */
function onColorChange() {
  const color = document.getElementById('color-picker').value
  if (trajectoryLine) {
    trajectoryLine.material.color.set(color)
  }
}