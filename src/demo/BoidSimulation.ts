import * as THREE from 'three'
import { Engine } from '../engine/Engine'
import { Boid } from './Boid'
import { SpatialGrid } from './SpatialGrid'

export class BoidSimulation {
  private boids: Boid[] = []
  private numBoids = 3000
  private boundary: THREE.Box3
  private spatialGrid: SpatialGrid
  private gridScale: number

  private attractionMode: boolean
  private attractionModeCooldown: number
  private attractionModeTimer: number
  private attractionDuration: number

  private previewPixels: boolean = false
  private batchSize: number
  private previewBatchIndex: number

  constructor(private engine: Engine, private size: number, gridScale: number) {
    this.boundary = new THREE.Box3(
      new THREE.Vector3(-this.size, -this.size, -this.size),
      new THREE.Vector3(this.size, this.size, this.size)
    )

    this.gridScale = gridScale || 1
    const numCells = Math.ceil(Math.pow(this.numBoids, 1 / 3))
    this.spatialGrid = new SpatialGrid(Math.pow(this.size, 3) / numCells) // Adjust the cell size as needed

    this.attractionMode = false
    this.attractionModeCooldown = 2000 // 5 seconds cooldown
    this.attractionModeTimer = 0
    this.attractionDuration = 1000 // 3 seconds of attraction

    this.batchSize = 50 // You can adjust this value based on your performance requirements
    this.previewBatchIndex = 0
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

  createBoids(boidCount: number) {
    const rows = Math.ceil(Math.sqrt(boidCount))
    const cols = Math.ceil(boidCount / rows)

    const gridWidth =
      (this.boundary.max.x - this.boundary.min.x) * this.gridScale
    const gridHeight =
      (this.boundary.max.y - this.boundary.min.y) * this.gridScale

    const cellWidth = gridWidth / cols
    const cellHeight = gridHeight / rows

    const centerX = (this.boundary.min.x + this.boundary.max.x) / 2
    const centerY = (this.boundary.min.y + this.boundary.max.y) / 2

    let index = 0

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (index < boidCount) {
          const target = new THREE.Vector2(
            centerX - gridWidth / 2 + cellWidth * (col + 0.5),
            centerY - gridHeight / 2 + cellHeight * (row + 0.5)
          )

          const pos = new THREE.Vector3(
            this.boundary.min.x +
              Math.random() * (this.boundary.max.x - this.boundary.min.x),
            this.boundary.min.y +
              Math.random() * (this.boundary.max.y - this.boundary.min.y),
            this.boundary.min.z +
              Math.random() * (this.boundary.max.z - this.boundary.min.z)
          )

          const boid = new Boid(pos, target)
          this.boids.push(boid)
          this.engine.scene.add(boid)

          index++
        }
      }
    }
  }

  init() {
    this.createBoids(this.numBoids)
    this.attachEventListeners()
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

    if (this.previewPixels) {
      const startIndex = this.previewBatchIndex * this.batchSize
      const endIndex = Math.min(startIndex + this.batchSize, this.boids.length)

      for (let i = 0; i < this.boids.length; i++) {
        const boid = this.boids[i]

        if (i >= startIndex && i < endIndex) {
          boid.attractToTarget()
        }

        boid.update(delta, this.previewPixels)
      }

      // Increment the previewBatchIndex
      this.previewBatchIndex++

      // Reset the previewBatchIndex if all boids are processed
      if (this.previewBatchIndex * this.batchSize >= this.boids.length) {
        this.previewBatchIndex = 0
      }
    } else {
      for (const boid of this.boids) {
        // boid.moveAwayFromTarget()
        const nearbyBoids = this.spatialGrid.query(
          boid.position,
          boid.genetics.perceptionRadius
        )
        const filteredBoids = nearbyBoids.filter(
          (nearbyBoid) => nearbyBoid !== boid
        )

        boid.flock(filteredBoids, 1.5, 1.0, 1.0, this.attractionMode)
        boid.boundaries(this.boundary, 2, 0.5, true)
        boid.update(delta, this.previewPixels)

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
