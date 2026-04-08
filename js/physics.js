/**
 * physics.js
 * Вся фізична логіка: балістична траєкторія (тіло кинуте під кутом до горизонту)
 *
 * Ключові зміни відносно попередньої версії (Лаб 2.1):
 *  - Замість загального прискорення 'a' у напрямі руху введено 'g' — прискорення
 *    вільного падіння, яке діє ЛИШЕ по осі Y у від'ємному напрямі.
 *  - Час польоту T_flight = 2·v₀·sin(α)/g обчислюється автоматично.
 *  - Доданий параметр alpha (кут кидання до горизонту) замість phi.
 *  - Додано функцію computeAnalytics() для аналітичних показників H та R.
 *  - Анімація зупиняється при y(t) ≤ 0.
 */

/**
 * Перетворює кути alpha (підйом від горизонталі) та theta (азимут у XZ) у
 * початкові компоненти швидкості.
 * @param {number} alpha - кут кидання до горизонту [°]
 * @param {number} theta - кут азимуту у горизонтальній площині XZ [°]
 * @param {number} v0    - початкова швидкість [м/с]
 * @returns {{ vx, vy, vz }}
 */
function computeVelocityComponents(alpha, theta, v0) {
  const aRad = alpha * Math.PI / 180
  const tRad = theta * Math.PI / 180

  return {
    vx: v0 * Math.cos(aRad) * Math.cos(tRad),
    vy: v0 * Math.sin(aRad),
    vz: v0 * Math.cos(aRad) * Math.sin(tRad)
  }
}

/**
 * Валідація вхідних параметрів для балістичної симуляції
 * @returns {string|null} - рядок помилки або null якщо все ок
 */
function validateParams(p) {
  if (isNaN(p.v0) || p.v0 <= 0)
    return 'Швидкість v₀ має бути більше нуля'
  if (isNaN(p.g) || p.g <= 0 || p.g > 20)
    return 'Прискорення g має бути у діапазоні 0–20 м/с²'
  if (isNaN(p.theta) || p.theta < 0 || p.theta > 360)
    return 'Кут θ має бути у діапазоні 0–360°'
  if (isNaN(p.alpha) || p.alpha < 1 || p.alpha > 90)
    return 'Кут α має бути у діапазоні 1–90°'
  return null
}

/**
 * Обчислює аналітичні показники балістичного польоту.
 * @param {{ v0, alpha, g }} params
 * @returns {{ H, R, Tflight }}
 */
function computeAnalytics(params) {
  const { v0, alpha, g } = params
  const aRad = alpha * Math.PI / 180

  const H = (v0 * v0 * Math.sin(aRad) * Math.sin(aRad)) / (2 * g)
  const R = (v0 * v0 * Math.sin(2 * aRad)) / g
  const Tflight = (2 * v0 * Math.sin(aRad)) / g

  return { H, R, Tflight }
}

/**
 * Обчислює масив точок параболічної траєкторії у 3D.
 *
 * Формули (балістика під кутом до горизонту):
 *   x(t) = x₀ + vₓ·t            (рівномірний по X)
 *   y(t) = y₀ + vᵧ·t − ½·g·t²  (рівноуповільнений по Y)
 *   z(t) = z₀ + vz·t            (рівномірний по Z)
 *   v(t) = √(vₓ² + (vᵧ−g·t)² + vz²)
 *   vy(t) = vᵧ − g·t
 *
 * Час польоту T_flight = 2·v₀·sin(α)/g — обчислюється автоматично.
 * Крок dt = 1/60 с відповідає 60 кадрам/с.
 * Симуляція зупиняється при y(t) ≤ 0 або після T_flight.
 *
 * @param {object} params - { x0, y0, z0, v0, alpha, theta, g }
 * @returns {Array<{x,y,z,t,v,vy}>}
 */
function computeTrajectory3D(params) {
  const { x0, y0, z0, v0, g } = params
  const { vx, vy: vy0, vz } = computeVelocityComponents(params.alpha, params.theta, v0)

  const { Tflight } = computeAnalytics(params)
  const dt = 1 / 60
  const steps = Math.ceil(Tflight / dt)
  const points = []

  for (let k = 0; k <= steps; k++) {
    const t = k * dt
    const y = y0 + vy0 * t - 0.5 * g * t * t

    // Зупиняємо при приземленні (y ≤ y0 після першого кроку)
    if (k > 0 && y < y0) {
      // Інтерполюємо точну точку приземлення
      const tLand = (2 * vy0) / g + y0 / (0.5 * g) // коли y = y0
      points.push({
        x: x0 + vx * tLand,
        y: y0,
        z: z0 + vz * tLand,
        t: tLand,
        v: Math.sqrt(vx * vx + (vy0 - g * tLand) ** 2 + vz * vz),
        vy: vy0 - g * tLand
      })
      break
    }

    const vyT = vy0 - g * t

    points.push({
      x: x0 + vx * t,
      y: y,
      z: z0 + vz * t,
      t: t,
      v: Math.sqrt(vx * vx + vyT * vyT + vz * vz),
      vy: vyT
    })
  }

  return points
}
