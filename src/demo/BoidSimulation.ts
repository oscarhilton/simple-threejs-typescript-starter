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
  private batchCounter: number

  constructor(
    private engine: Engine,
    private size: number,
    private speedFactor: number
  ) {
    this.boundary = new THREE.Box3(
      new THREE.Vector3(-this.size, -this.size, -this.size / 3),
      new THREE.Vector3(this.size, this.size, this.size / 3)
    )

    this.numBoids = this.size
    this.speedFactor = speedFactor

    const numCells = Math.ceil(Math.sqrt(this.numBoids))
    this.spatialGrid = new SpatialGrid(numCells)

    this.attractionMode = false
    this.attractionModeCooldown = 1000 // 5 seconds cooldown
    this.attractionModeTimer = 0
    this.attractionDuration = 100 // 3 seconds of attraction

    this.batchSize = this.size // You can adjust this value based on your performance requirements
    this.batchCounter = 0

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
        this.boids.forEach((boid) => {
          if (!this.previewPixels) {
            boid.applyRandomForce(10)
          }
        })
      }
    })
  }

  async init() {
    const initialGridSize = Math.ceil(Math.sqrt(this.numBoids))
    const imageResult = await this.loadImage(
      'assets/test.png',
      initialGridSize,
      initialGridSize
    )

    if (imageResult) {
      const { imageData, dimensions } = imageResult
      const totalPixels = imageData.width * imageData.height
      const gridSize = totalPixels
      this.numBoids = totalPixels * 5

      this.createBoids(
        this.numBoids,
        imageData.data,
        gridSize,
        dimensions,
        dimensions.width
      )

      this.attachEventListeners()
    }
  }

  createBoids(
    boidCount: number,
    pixelData: any,
    gridSize: number,
    dimensions: { width: number; height: number },
    imageWidth: number,
    sizeFactor: number = 1.8,
    spacingFactor: number = 10
  ) {
    const rows = Math.sqrt(boidCount)
    const cols = Math.sqrt(boidCount)

    // Adjust the grid width and height based on the aspect ratio
    const gridWidth = dimensions.width * sizeFactor * spacingFactor
    const gridHeight = dimensions.height * sizeFactor * spacingFactor

    const cellWidth = gridWidth / (gridSize - 1)
    const cellHeight = gridHeight / (gridSize - 1)

    const centerX =
      this.boundary.min.x + (this.boundary.max.x - this.boundary.min.x) / 2
    const centerY =
      this.boundary.min.y + (this.boundary.max.y - this.boundary.min.y) / 2

    let index = 0

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (index < boidCount) {
          const targetColor = new THREE.Color()

          const imgRow = Math.floor(row * (imageWidth / cols))
          const imgCol = Math.floor(col * (imageWidth / cols))
          const pixelIndex = (imgRow * imageWidth + imgCol) * 4

          const target = new THREE.Vector2(
            centerX - gridWidth / 2 + cellWidth * col * spacingFactor,
            centerY - gridHeight / 2 + cellHeight * row * spacingFactor
          )

          targetColor.setRGB(
            pixelData[pixelIndex] / 255,
            pixelData[pixelIndex + 1] / 255,
            pixelData[pixelIndex + 2] / 255
          )

          const pos = new THREE.Vector3(
            target.x,
            target.y,
            this.boundary.max.z / 2
          )

          const boid = new Boid(pos, target, targetColor)
          this.boids.push(boid)
          this.engine.scene.add(boid)

          index++
        }
      }
    }
  }

  loadImage(
    src: string,
    maxWidth: number,
    maxHeight: number
  ): Promise<{
    imageData: ImageData
    dimensions: { width: number; height: number }
  } | null> {
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

        if (!ctx) throw new Error('No context for canvas')

        ctx.drawImage(image, 0, 0, newWidth, newHeight)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const dimensions = { width: newWidth, height: newHeight }
        resolve({ imageData, dimensions })
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

  createExpandedBoundary(
    boundary: THREE.Box3,
    expansionFactor: number = 1.5
  ): THREE.Box3 {
    const width = boundary.max.x - boundary.min.x
    const height = boundary.max.y - boundary.min.y
    const depth = boundary.max.z - boundary.min.z

    const newWidth = width * expansionFactor
    const newHeight = height * expansionFactor
    const newDepth = depth * expansionFactor

    const centerX = (boundary.min.x + boundary.max.x) / 2
    const centerY = (boundary.min.y + boundary.max.y) / 2
    const centerZ = (boundary.min.z + boundary.max.z) / 2

    const expandedBoundary = new THREE.Box3(
      new THREE.Vector3(
        centerX - newWidth / 2,
        centerY - newHeight / 2,
        centerZ - newDepth / 2
      ),
      new THREE.Vector3(
        centerX + newWidth / 2,
        centerY + newHeight / 2,
        centerZ + newDepth / 2
      )
    )

    return expandedBoundary
  }

  update(delta: number) {
    delta *= this.speedFactor
    this.spatialGrid.clear()

    for (const boid of this.boids) {
      this.spatialGrid.insert(boid)
    }

    const distanceRadius = 2 // Adjust this value based on your desired slowdown radius

    const batchSize = this.batchSize // Number of boids to update per iteration, adjust as needed
    const startIndex = this.batchCounter * batchSize
    const endIndex = Math.min(startIndex + batchSize, this.boids.length)

    for (let i = startIndex; i < endIndex; i++) {
      const boid = this.boids[i]
      boid.seeking = this.previewPixels

      if (this.previewPixels) {
        boid.attractToTarget(0.8) // Reduce the attraction force by using a smaller value, e.g., 0.1
      }
      this.flyAround(boid)

      const target = new THREE.Vector3(boid.target.x, boid.target.y, 0)
      boid.boundaries(this.boundary, 2, 20, false)
      this.spatialGrid.remove(boid)

      boid.update(delta, this.boundary, 0.1, target, distanceRadius)
      this.spatialGrid.insert(boid)
    }

    this.batchCounter =
      (this.batchCounter + 1) % Math.ceil(this.boids.length / batchSize)

    // Decrease attractionModeTimer
    this.attractionModeTimer -= delta * 10

    // Check if attraction mode should be active
    this.attractionMode = this.attractionModeTimer > this.attractionModeCooldown

    // If attractionModeTimer is less than or equal to 0, reset the timer
    if (this.attractionModeTimer <= 0) {
      this.attractionModeTimer =
        this.attractionDuration + this.attractionModeCooldown
    }
  }

  flyAround(boid: Boid) {
    const nearbyBoids = this.spatialGrid.query(
      boid.position,
      boid.genetics.perceptionRadius
    )
    const filteredBoids = nearbyBoids.filter(
      (nearbyBoid) => nearbyBoid !== boid
    )

    // if (this.previewPixels) {
    // boid.flock(filteredBoids, 0, 0, 0, this.attractionMode)
    // } else {
    // Increase the force multipliers for separation, alignment, and cohesion
    boid.flock(filteredBoids, 2.5, 1.0, 1.0)
    // }

    // Update the boid's position and rotation
    boid.position.copy(boid.position)
    boid.lookAt(boid.position.clone().add(boid.velocity))
  }

  toggleAttractionMode() {
    // If the attraction mode is not active, reset the timer to trigger attraction mode immediately
    if (!this.attractionMode) {
      this.attractionModeTimer = this.attractionModeCooldown
    }
  }
}
