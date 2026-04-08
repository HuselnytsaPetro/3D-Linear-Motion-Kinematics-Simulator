/**
 * renderer.js
 * Вся робота з Three.js: сцена, камера, лінії, маркери, анімація, tooltip.
 *
 * Зміни відносно попередньої версії (Лаб 2.1):
 *  - trajectoryLine та markerSphere перетворені з одиничних об'єктів
 *    у масиви allTrajectories[] та allMarkers[] для підтримки
 *    накопичення декількох траєкторій без очищення при кожному запуску.
 *  - Додано систему raycast-hover: при наведенні миші на будь-яку
 *    точку будь-якої траєкторії з'являється tooltip з координатами.
 *  - Додано функцію clearAllTrajectories() для кнопки "Очистити сцену".
 *  - Анімація автоматично зупиняється в момент приземлення (y ≤ y0).
 */

// ── Масиви для накопичення об'єктів усіх симуляцій ──────────
// Кожен елемент: { line, points }
const allTrajectories = []
// Кожен елемент: THREE.Mesh
const allMarkers = []

// ── Tooltip DOM-елемент ──────────────────────────────────────
let tooltipEl = null

/**
 * Ініціалізація сцени — викликається один раз при старті
 */
function initScene() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0a1f0d)

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    5000
  )
  camera.position.set(150, 100, 150)
  camera.lookAt(0, 0, 0)

  const canvas = document.getElementById('three-canvas')
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)

  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(200, 300, 200)
  scene.add(ambient, dirLight)

  controls = new THREE.OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  // Створюємо tooltip-елемент і прикріплюємо до DOM
  tooltipEl = document.createElement('div')
  tooltipEl.id = 'trajectory-tooltip'
  tooltipEl.style.cssText = `
    position:fixed; display:none; pointer-events:none;
    background:rgba(13,17,23,0.92); border:1px solid #30363d;
    border-radius:8px; padding:8px 12px; font-size:11px;
    color:#97c457; z-index:100; backdrop-filter:blur(8px);
    line-height:1.8;
  `
  document.body.appendChild(tooltipEl)

  // Слухач руху миші для hover-tooltip
  canvas.addEventListener('mousemove', onCanvasMouseMove)
  canvas.addEventListener('mouseleave', () => { tooltipEl.style.display = 'none' })
}

/**
 * Обробник руху миші — знаходить найближчу точку будь-якої траєкторії
 * та показує tooltip з координатами.
 */
function onCanvasMouseMove(event) {
  if (allTrajectories.length === 0) {
    tooltipEl.style.display = 'none'
    return
  }

  // Нормалізовані координати пристрою (-1..+1)
  const rect = renderer.domElement.getBoundingClientRect()
  const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1
  const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1

  // Промінь із камери
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera)

  // Шукаємо найближчу точку серед усіх траєкторій
  let bestDist = Infinity
  let bestPoint = null

  for (const traj of allTrajectories) {
    for (const pt of traj.points) {
      const worldVec = new THREE.Vector3(pt.x, pt.y, pt.z)
      // Відстань від проміня до точки у 3D
      const dist = raycaster.ray.distanceToPoint(worldVec)
      if (dist < bestDist) {
        bestDist = dist
        bestPoint = pt
      }
    }
  }

  // Поріг у метрах сцени — при більшій відстані не показуємо
  const threshold = 5

  if (bestPoint && bestDist < threshold) {
    tooltipEl.innerHTML =
      `x: <b>${bestPoint.x.toFixed(2)}</b> м<br>` +
      `y: <b>${bestPoint.y.toFixed(2)}</b> м<br>` +
      `z: <b>${bestPoint.z.toFixed(2)}</b> м<br>` +
      `t: <b>${bestPoint.t.toFixed(2)}</b> с<br>` +
      `v: <b>${bestPoint.v.toFixed(2)}</b> м/с`
    tooltipEl.style.display = 'block'
    tooltipEl.style.left = (event.clientX + 16) + 'px'
    tooltipEl.style.top = (event.clientY - 10) + 'px'
  } else {
    tooltipEl.style.display = 'none'
  }
}

/**
 * Додає осі координат і сітку — викликається один раз після initScene()
 */
function addAxes() {
  const axesHelper = new THREE.AxesHelper(200)
  scene.add(axesHelper)

  const gridHelper = new THREE.GridHelper(400, 40, 0x444444, 0x222222)
  scene.add(gridHelper)
}

/**
 * Будує THREE.Line з масиву точок траєкторії та додає до allTrajectories[].
 * @param {Array<{x,y,z}>} points
 * @param {string} color - hex-колір (#00aaff)
 */
function buildTrajectoryLine(points, color) {
  const positions = new Float32Array(points.length * 3)

  for (let i = 0; i < points.length; i++) {
    positions[i * 3] = points[i].x
    positions[i * 3 + 1] = points[i].y
    positions[i * 3 + 2] = points[i].z
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(color)
  })

  const line = new THREE.Line(geometry, material)
  scene.add(line)

  // Зберігаємо разом із точками для hover
  allTrajectories.push({ line, points })

  // Повертаємо посилання (використовується в clearScene для legacy-сумісності)
  trajectoryLine = line
  return line
}

/**
 * Створює сферу-маркер на початковій позиції та додає до allMarkers[].
 * @param {number} x0, y0, z0 — початкові координати
 */
function createMarker(x0, y0, z0) {
  const geometry = new THREE.SphereGeometry(2.5, 16, 16)
  const material = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
    emissive: 0xFFFFFF,
    emissiveIntensity: 0.2,
    roughness: 0.3,
    metalness: 0.1
  })

  const sphere = new THREE.Mesh(geometry, material)
  sphere.position.set(x0, y0, z0)
  scene.add(sphere)

  allMarkers.push(sphere)
  markerSphere = sphere
  return sphere
}

/**
 * Запускає анімаційний цикл — сфера рухається вздовж points[].
 * Автоматично зупиняє анімацію маркера при досягненні кінця масиву (приземлення).
 * @param {Array<{x,y,z,t,v,vy}>} points
 */
function animateMarker(points) {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  // Захоплюємо посилання на сферу, яка була щойно створена
  const sphere = markerSphere
  let currentIndex = 0

  function animate() {
    if (currentIndex < points.length) {
      const pt = points[currentIndex]
      sphere.position.set(pt.x, pt.y, pt.z)
      updateInfoPanel(pt)
      currentIndex++
    }
    // Після завершення маркер залишається у кінцевій точці (не видаляємо)

    controls.update()
    renderer.render(scene, camera)
    animationId = requestAnimationFrame(animate)
  }

  animate()
}

/**
 * Видаляє ВСІ траєкторії та маркери зі сцени (кнопка "Очистити сцену").
 * Звільняє пам'ять GPU для кожного об'єкта.
 */
function clearAllTrajectories() {
  // Видаляємо всі лінії траєкторій
  for (const traj of allTrajectories) {
    scene.remove(traj.line)
    traj.line.geometry.dispose()
    traj.line.material.dispose()
  }
  allTrajectories.length = 0

  // Видаляємо всі маркери
  for (const sphere of allMarkers) {
    scene.remove(sphere)
    sphere.geometry.dispose()
    sphere.material.dispose()
  }
  allMarkers.length = 0

  // Зупиняємо анімацію
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  trajectoryLine = null
  markerSphere = null

  tooltipEl.style.display = 'none'
}

/**
 * clearScene — сумісність зі старим кодом main.js.
 * Тепер НЕ очищає сцену при кожному запуску.
 * Використовується лише для зупинки попередньої анімації маркера.
 */
function clearScene() {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
}