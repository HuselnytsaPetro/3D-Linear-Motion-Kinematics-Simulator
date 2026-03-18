/**
 * renderer.js
 * Вся робота з Three.js: сцена, камера, лінія, маркер, анімація
 */

// Глобальні змінні Three.js сцени
let scene, camera, renderer, controls
let trajectoryLine = null
let markerSphere   = null
let animationId    = null

/**
 * Ініціалізація сцени — викликається один раз при старті
 */
function initScene() {
  // Сцена — порожній 3D-простір
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0D1117)

  // Камера з перспективною проєкцією
  // fov=60°, near=0.1, far=5000
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    5000
  )
  camera.position.set(150, 100, 150)
  camera.lookAt(0, 0, 0)

  // Рендерер — прив'язується до canvas
  const canvas = document.getElementById('three-canvas')
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)

  // Освітлення
  const ambient  = new THREE.AmbientLight(0xffffff, 0.6)
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(200, 300, 200)
  scene.add(ambient, dirLight)

  // OrbitControls — обертання/зум мишею
  controls = new THREE.OrbitControls(camera, renderer.domElement)
  controls.enableDamping  = true
  controls.dampingFactor  = 0.05

  // Адаптивність при зміні розміру вікна
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })
}

/**
 * Додає осі координат і сітку — викликається один раз після initScene()
 */
function addAxes() {
  // AxesHelper: X — червона, Y — зелена, Z — синя
  const axesHelper = new THREE.AxesHelper(200)
  scene.add(axesHelper)

  // GridHelper — сітка у горизонтальній площині XZ
  const gridHelper = new THREE.GridHelper(400, 40, 0x444444, 0x222222)
  scene.add(gridHelper)
}

/**
 * Будує THREE.Line з масиву точок траєкторії
 * @param {Array<{x,y,z}>} points
 * @param {string} color - hex-колір (#00aaff)
 */
function buildTrajectoryLine(points, color) {
  // Float32Array — формат який розуміє GPU
  const positions = new Float32Array(points.length * 3)

  for (let i = 0; i < points.length; i++) {
    positions[i * 3]     = points[i].x
    positions[i * 3 + 1] = points[i].y
    positions[i * 3 + 2] = points[i].z
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3)
  )

  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(color)
  })

  trajectoryLine = new THREE.Line(geometry, material)
  scene.add(trajectoryLine)
}

/**
 * Створює сферу-маркер на початковій позиції
 * @param {number} x0, y0, z0 — початкові координати
 */
function createMarker(x0, y0, z0) {
  const geometry = new THREE.SphereGeometry(2.5, 16, 16)
  const material = new THREE.MeshStandardMaterial({
    color:             0xFF6B35,
    emissive:          0xFF6B35,
    emissiveIntensity: 0.4,
    roughness:         0.4,
    metalness:         0.3
  })

  markerSphere = new THREE.Mesh(geometry, material)
  markerSphere.position.set(x0, y0, z0)
  scene.add(markerSphere)
}

/**
 * Запускає анімаційний цикл — сфера рухається вздовж points[]
 * @param {Array<{x,y,z,t,v}>} points
 */
function animateMarker(points) {
  // Зупиняємо попередню анімацію якщо є
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  let currentIndex = 0

  function animate() {
    // Рухаємо сферу якщо є ще точки
    if (currentIndex < points.length) {
      const pt = points[currentIndex]
      markerSphere.position.set(pt.x, pt.y, pt.z)
      updateInfoPanel(pt)
      currentIndex++
    }

    // Оновлюємо OrbitControls (потрібно для inertia)
    controls.update()

    // Малюємо кадр
    renderer.render(scene, camera)

    // Запитуємо наступний кадр
    animationId = requestAnimationFrame(animate)
  }

  animate()
}

/**
 * Видаляє траєкторію і маркер зі сцени та звільняє пам'ять GPU
 */
function clearScene() {
  if (trajectoryLine) {
    scene.remove(trajectoryLine)
    trajectoryLine.geometry.dispose()
    trajectoryLine.material.dispose()
    trajectoryLine = null
  }
  if (markerSphere) {
    scene.remove(markerSphere)
    markerSphere.geometry.dispose()
    markerSphere.material.dispose()
    markerSphere = null
  }
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
}