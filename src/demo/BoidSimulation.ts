import * as THREE from 'three'
import { Engine } from '../engine/Engine'
import { Boid } from './Boid'
import { SpatialGrid } from './SpatialGrid'

export class BoidSimulation {
  private boids: Boid[] = []
  private numBoids: number
  private boundary: THREE.Box3
  private spatialGrid: SpatialGrid

  private attractionMode: boolean
  private attractionModeCooldown: number
  private attractionModeTimer: number
  private attractionDuration: number

  private previewPixels: boolean = false
  private batchSize: number
  private previewBatchIndex: number

  constructor(private engine: Engine, private size: number) {
    this.boundary = new THREE.Box3(
      new THREE.Vector3(-this.size, -this.size, -10),
      new THREE.Vector3(this.size, this.size, 10)
    )

    this.numBoids = size * 5

    const numCells = Math.ceil(Math.pow(this.numBoids, 1 / 3))
    this.spatialGrid = new SpatialGrid(Math.pow(this.size, 6) / numCells) // Adjust the cell size as needed

    this.attractionMode = false
    this.attractionModeCooldown = 2000 // 5 seconds cooldown
    this.attractionModeTimer = 0
    this.attractionDuration = 1000 // 3 seconds of attraction

    this.batchSize = 50 // You can adjust this value based on your performance requirements
    this.previewBatchIndex = 0

    this.init()
  }

  private attachEventListeners() {
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space') {
        this.previewPixels = true
      }
    })

    window.addEventListener('keyup', (event) => {
      if (event.code === 'Space') {
        this.previewPixels = false
      }
    })
  }

  createBoids(
    boidCount: number,
    pixelData: any,
    gridSize: number,
    sizeFactor: number = 0.01,
    spacingFactor: number = 1
  ) {
    const rows = gridSize
    const cols = gridSize

    const gridWidth = (this.boundary.max.x - this.boundary.min.x) * sizeFactor
    const gridHeight = (this.boundary.max.y - this.boundary.min.y) * sizeFactor

    const spacing = spacingFactor

    const cellWidth =
      cols - 1 === 0 ? 0 : (gridWidth - spacing * (cols - 1)) / (cols - 1)
    const cellHeight =
      rows - 1 === 0 ? 0 : (gridHeight - spacing * (rows - 1)) / (rows - 1)

    const centerX = (this.boundary.min.x + this.boundary.max.x) / 2
    const centerY = (this.boundary.min.y + this.boundary.max.y) / 2

    let index = 0

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (index < boidCount) {
          const targetColor = new THREE.Color()

          const pixelIndex = (row * gridSize + col) * 4 // Multiply by 4 because of the RGBA channels

          const target = new THREE.Vector2(
            centerX - gridWidth / 2 + (cellWidth + spacing) * col,
            centerY - gridHeight / 2 + (cellHeight + spacing) * row
          )

          targetColor.setRGB(
            pixelData[pixelIndex] / 255,
            pixelData[pixelIndex + 1] / 255,
            pixelData[pixelIndex + 2] / 255
          )

          const pos = new THREE.Vector3(
            this.boundary.min.x +
              Math.random() * (this.boundary.max.x - this.boundary.min.x),
            this.boundary.min.y +
              Math.random() * (this.boundary.max.y - this.boundary.min.y),
            this.boundary.min.z +
              Math.random() * (this.boundary.max.z - this.boundary.min.z)
          )

          const boid = new Boid(pos, target, targetColor)
          this.boids.push(boid)
          this.engine.scene.add(boid)

          index++
        }
      }
    }
  }

  async init() {
    const gridSize = Math.ceil(Math.sqrt(this.numBoids))
    const imageData = await this.loadImage(
      'assets/test.png',
      gridSize,
      gridSize
    )
    if (imageData) {
      this.createBoids(this.numBoids, imageData.data, gridSize, 0.5, 2)

      this.attachEventListeners()
    }
  }

  loadImage(
    src: string,
    maxWidth: number,
    maxHeight: number
  ): Promise<ImageData | null> {
    return new Promise((resolve) => {
      const image = new Image()
      image.src = src
      image.onload = () => {
        const aspectRatio = image.width / image.height
        let newWidth = maxWidth
        let newHeight = maxHeight

        if (aspectRatio > 1) {
          newHeight = maxWidth / aspectRatio
        } else {
          newWidth = maxHeight * aspectRatio
        }

        // Make sure the new dimensions are integers
        newWidth = Math.round(newWidth)
        newHeight = Math.round(newHeight)

        const canvas = document.createElement('canvas')
        canvas.width = newWidth
        canvas.height = newHeight

        const ctx = canvas.getContext('2d')
        ctx.drawImage(image, 0, 0, newWidth, newHeight)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        resolve(imageData)
      }
      image.onerror = () => {
        resolve(null)
      }
    })
  }

  addBoid(boid: Boid) {
    this.boids.push(boid)
    this.spatialGrid.insert(boid)
  }

  removeBoid(boid: Boid) {
    const index = this.boids.indexOf(boid)
    if (index > -1) {
      this.boids.splice(index, 1)
      this.spatialGrid.remove(boid)
    }
  }

  getWeakestBoidIndex(boids: Boid[]): number {
    let weakestBoidIndex = -1
    let minFitness = Infinity
    for (let i = 0; i < boids.length; i++) {
      const boidFitness = boids[i].genetics.getFitness()
      if (boidFitness < minFitness) {
        minFitness = boidFitness
        weakestBoidIndex = i
      }
    }
    return weakestBoidIndex
  }

  update(delta: number) {
    this.spatialGrid.clear()

    for (const boid of this.boids) {
      this.spatialGrid.insert(boid)
    }

    const distanceRadius = 1 // Adjust this value based on your desired slowdown radius

    if (this.previewPixels) {
      const startIndex = this.previewBatchIndex * this.batchSize
      const endIndex = Math.min(startIndex + this.batchSize, this.boids.length)

      for (let i = 0; i < this.boids.length; i++) {
        const boid = this.boids[i]

        if (i >= startIndex && i < endIndex) {
          boid.attractToTarget(1) // Reduce the attraction force by using a smaller value, e.g., 0.1
        }

        const target = new THREE.Vector3(boid.target.x, boid.target.y, 0)
        boid.update(delta, this.previewPixels, target, distanceRadius)
      }

      // Increment the previewBatchIndex
      this.previewBatchIndex++

      // Reset the previewBatchIndex if all boids are processed
      if (this.previewBatchIndex * this.batchSize >= this.boids.length) {
        this.previewBatchIndex = 0
      }
    } else {
      for (const boid of this.boids) {
        const nearbyBoids = this.spatialGrid.query(
          boid.position,
          boid.genetics.perceptionRadius
        )
        const filteredBoids = nearbyBoids.filter(
          (nearbyBoid) => nearbyBoid !== boid
        )

        boid.flock(filteredBoids, 1.5, 1.0, 1.0, this.attractionMode)
        boid.boundaries(this.boundary, 2, 0.5, true)
        boid.update(delta)

        // Update the boid's position and rotation
        boid.position.copy(boid.position)
        boid.lookAt(boid.position.clone().add(boid.velocity))
      }
    }

    // Decrease attractionModeTimer
    this.attractionModeTimer -= delta * 1000

    // Check if attraction mode should be active
    this.attractionMode = this.attractionModeTimer > this.attractionModeCooldown

    // If attractionModeTimer is less than or equal to 0, reset the timer
    if (this.attractionModeTimer <= 0) {
      this.attractionModeTimer =
        this.attractionDuration + this.attractionModeCooldown
    }
  }

  toggleAttractionMode() {
    // If the attraction mode is not active, reset the timer to trigger attraction mode immediately
    if (!this.attractionMode) {
      this.attractionModeTimer = this.attractionModeCooldown
    }
  }
}
