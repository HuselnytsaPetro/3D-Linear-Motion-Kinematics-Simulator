/**
 * physics.js
 * Вся фізична логіка: вектор напряму + масив точок траєкторії
 */

/**
 * Перетворює два кути у одиничний вектор напряму
 * @param {number} theta - азимут у горизонтальній площині XZ [°]
 * @param {number} phi   - кут підйому від горизонталі [°]
 * @returns {{ dx, dy, dz }}
 */
function computeDirection(theta, phi) {
  const thetaRad = theta * Math.PI / 180
  const phiRad   = phi   * Math.PI / 180

  return {
    dx: Math.cos(phiRad) * Math.cos(thetaRad),
    dy: Math.sin(phiRad),
    dz: Math.cos(phiRad) * Math.sin(thetaRad)
  }
}

/**
 * Валідація вхідних параметрів
 * @returns {string|null} - рядок помилки або null якщо все ок
 */
function validateParams(p) {
  if (isNaN(p.v0) || p.v0 < 0)
    return 'Швидкість v₀ не може бути від\'ємною'
  if (isNaN(p.T) || p.T <= 0)
    return 'Час T має бути більше нуля'
  if (isNaN(p.theta) || p.theta < 0 || p.theta > 360)
    return 'Кут θ має бути у діапазоні 0–360°'
  if (isNaN(p.phi) || p.phi < -90 || p.phi > 90)
    return 'Кут φ має бути у діапазоні −90…+90°'
  return null
}

/**
 * Обчислює масив точок траєкторії у 3D
 * Δt = 1/60 с — крок відповідає 60 кадрам/с
 * @returns {Array<{x,y,z,t,v}>}
 */
function computeTrajectory3D(params) {
  const { x0, y0, z0, v0, a, T } = params
  const { dx, dy, dz } = computeDirection(params.theta, params.phi)

  const dt    = 1 / 60
  const steps = Math.ceil(T / dt)
  const points = []

  for (let k = 0; k <= steps; k++) {
    const t  = k * dt
    const t2 = t * t  // t² — рахуємо один раз

    points.push({
      x: x0 + v0 * dx * t + 0.5 * a * dx * t2,
      y: y0 + v0 * dy * t + 0.5 * a * dy * t2,
      z: z0 + v0 * dz * t + 0.5 * a * dz * t2,
      t: t,
      v: v0 + a * t
    })
  }

  return points
}