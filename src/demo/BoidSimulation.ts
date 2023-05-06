import * as THREE from 'three'
import { Engine } from '../engine/Engine'
import { Boid } from './Boid'
import { SpatialGrid } from './SpatialGrid'

export class BoidSimulation {
  private boids: Boid[] = []
  private numBoids = 3000
  private boundary: THREE.Box3
  private spatialGrid: SpatialGrid

  constructor(private engine: Engine, private size: number) {
    this.boundary = new THREE.Box3(
      new THREE.Vector3(-this.size, -this.size, -this.size),
      new THREE.Vector3(this.size, this.size, this.size)
    )

    this.spatialGrid = new SpatialGrid(this.numBoids / this.size) // Adjust the cell size as needed
  }

  init() {
    for (let i = 0; i < this.numBoids; i++) {
      const pos = new THREE.Vector3(
        Math.random() * this.size - this.size / 2,
        Math.random() * this.size - this.size / 2,
        Math.random() * this.size - this.size / 2
      )
      const boid = new Boid(pos)
      this.boids.push(boid)
      this.engine.scene.add(boid)
    }
  }

  update() {
    this.spatialGrid.clear()

    for (const boid of this.boids) {
      this.spatialGrid.insert(boid)
    }

    for (const boid of this.boids) {
      const nearbyBoids = this.spatialGrid.query(
        boid.position,
        boid.genetics.perceptionRadius
      )
      const filteredBoids = nearbyBoids.filter(
        (nearbyBoid) => nearbyBoid !== boid
      )

      boid.flock(filteredBoids, 1.5, 1.0, 1.0, false)
      boid.boundaries(this.boundary, 2, 0.5, true)
      boid.update()

      // Update the boid's position and rotation
      boid.position.copy(boid.position)
      boid.lookAt(boid.position.clone().add(boid.velocity))
    }
  }
}
