// Boid.ts
import * as THREE from 'three'
import { Box } from './Box'
import { BoidGenetics } from './BoidGenetics'

export class Boid extends Box {
  velocity: THREE.Vector3
  acceleration: THREE.Vector3
  position: THREE.Vector3
  genetics: BoidGenetics
  target: THREE.Vector2
  reachedTarget: boolean = false

  private moveAwayFromTargetActive: boolean = false
  private moveAwayFromTargetTimer: number = 0

  constructor(pos: THREE.Vector3, target: THREE.Vector2) {
    super()

    this.target = target
    console.log('Boid target:', target)

    this.genetics = new BoidGenetics()
    this.applyColorFromGenetics()

    this.velocity = this.getRandomVelocity()
    this.acceleration = new THREE.Vector3()
    this.position = new THREE.Vector3().copy(pos)
  }

  public applyRandomForce() {
    const randomDirection = this.getRandomVelocity()
    const target = randomDirection.multiplyScalar(0.1)
    this.applyForce(target)
  }

  private applyColorFromGenetics() {
    const material = this.material as THREE.MeshStandardMaterial
    if (!material.uniforms.color) {
      material.uniforms.color = { value: this.genetics.color }
    } else {
      material.uniforms.color.value.copy(this.genetics.color)
    }
  }

  getRandomVelocity() {
    const maxSpeed = this.genetics.maxSpeed
    return new THREE.Vector3(
      Math.random() * maxSpeed - maxSpeed / 2,
      Math.random() * maxSpeed - maxSpeed / 2,
      Math.random() * maxSpeed - maxSpeed / 2
    )
  }

  update(delta: number, previewPixels: boolean) {
    const maxSpeed = this.genetics.maxSpeed
    this.velocity.add(this.acceleration)
    this.velocity.clampScalar(-maxSpeed, maxSpeed)
    this.position.add(this.velocity)
    this.acceleration.multiplyScalar(0)

    if (this.moveAwayFromTargetActive) {
      this.moveAwayFromTargetTimer -= delta

      if (this.moveAwayFromTargetTimer <= 0) {
        this.moveAwayFromTargetActive = false
      } else {
        this.moveAwayFromTargetBehavior()
      }
    }
  }

  private moveAwayFromTargetBehavior() {
    const desired = this.getRandomVelocity()
      .clone()
      .sub(this.position)
      .normalize()
      .multiplyScalar(-this.genetics.maxSpeed)
    const steer = desired.sub(this.velocity)
    this.applyForce(steer)
  }

  applyForce(force: THREE.Vector3) {
    this.acceleration.add(force)
  }

  seek(target: THREE.Vector3) {
    const desired = target.clone().sub(this.position)
    desired.normalize().multiplyScalar(this.genetics.maxSpeed)
    const steer = desired.clone().sub(this.velocity)
    steer.clampScalar(-this.genetics.maxForce, this.genetics.maxForce)
    return steer
  }

  getAverageCenter(boids: Boid[]): THREE.Vector3 {
    const averageCenter = new THREE.Vector3()

    if (boids.length === 0) {
      return averageCenter
    }

    for (const boid of boids) {
      averageCenter.add(boid.position)
    }

    averageCenter.divideScalar(boids.length)
    return averageCenter
  }

  flock(
    boids: Boid[],
    separationWeight: number,
    alignmentWeight: number,
    cohesionWeight: number,
    attractionMode: boolean
  ) {
    if (this.reachedTarget) {
      return
    }
    if (attractionMode) {
      this.attract(boids, 0.35)
      const separation = this.separate(boids)
      this.applyForce(separation)
      this.breed(boids, 0.1) // 0.1 is the breeding probability
    } else {
      const separation = this.separate(boids)
      const alignment = this.align(boids)
      const cohesion = this.cohere(boids)

      separation.multiplyScalar(separationWeight)
      alignment.multiplyScalar(alignmentWeight)
      cohesion.multiplyScalar(cohesionWeight)

      this.applyForce(separation)
      this.applyForce(alignment)
      this.applyForce(cohesion)
    }
  }

  handleCollision(neighbors: Boid[], collisionRadius: number) {
    const repulsionForce = new THREE.Vector3()

    neighbors.forEach((neighbor) => {
      const distance = this.position.distanceTo(neighbor.position)

      if (distance > 0 && distance < collisionRadius) {
        const repulsion = this.position
          .clone()
          .sub(neighbor.position)
          .normalize()
        repulsionForce.add(repulsion.divideScalar(distance))
      }
    })

    this.acceleration.add(repulsionForce)
  }

  separate(boids: Boid[], desiredSeparation = 2.0) {
    const steer = new THREE.Vector3()
    let count = 0
    boids.forEach((boid) => {
      const distance = this.position.distanceTo(boid.position)
      if (distance > 0 && distance < desiredSeparation) {
        const diff = this.position
          .clone()
          .sub(boid.position)
          .normalize()
          .divideScalar(distance)
        steer.add(diff)
        count++
      }
    })

    if (count > 0) {
      steer.divideScalar(count)
    }

    if (steer.length() > 0) {
      steer
        .normalize()
        .multiplyScalar(this.genetics.maxSpeed)
        .sub(this.velocity)
        .clampScalar(-this.genetics.maxForce, this.genetics.maxForce)
    }

    return steer
  }

  attractToTarget(decelerationDistance: number = 5) {
    const desired = new THREE.Vector3(this.target.x, this.target.y, 0)
    desired.sub(this.position)

    const distance = desired.length()
    desired.normalize()

    this.velocity.multiplyScalar(0.5)
    const steering = desired.sub(this.velocity)

    this.reachedTarget = distance < decelerationDistance

    let speed = distance < decelerationDistance ? distance : 1
    steering.multiplyScalar((distance / decelerationDistance) * speed)

    steering.clampLength(-1, 1)

    if (!this.reachedTarget) {
      this.applyForce(steering)
    }
  }

  moveAwayFromTarget(duration: number) {
    this.moveAwayFromTargetActive = true
    this.moveAwayFromTargetTimer = duration
  }

  align(boids: Boid[], neighborDist = 5.0) {
    const sum = new THREE.Vector3()
    let count = 0
    boids.forEach((boid) => {
      const distance = this.position.distanceTo(boid.position)
      if (distance > 0 && distance < neighborDist) {
        sum.add(boid.velocity)
        count++
      }
    })

    if (count > 0) {
      sum.divideScalar(count).normalize().multiplyScalar(this.genetics.maxSpeed)
      const steer = sum
        .clone()
        .sub(this.velocity)
        .clampScalar(-this.genetics.maxForce, this.genetics.maxForce)
      return steer
    } else {
      return new THREE.Vector3()
    }
  }

  cohere(boids: Boid[], neighborDist = 1.0) {
    const sum = new THREE.Vector3()
    let count = 0
    boids.forEach((boid) => {
      const distance = this.position.distanceTo(boid.position)
      if (distance > 0 && distance < neighborDist) {
        sum.add(boid.position)
        count++
      }
    })

    if (count > 0) {
      sum.divideScalar(count)
      return this.seek(sum)
    } else {
      return new THREE.Vector3()
    }
  }

  attract(neighbors: Boid[], attractionForce: number) {
    const averagePosition = new THREE.Vector3()

    if (neighbors.length === 0) return

    for (const neighbor of neighbors) {
      averagePosition.add(neighbor.position)
    }
    averagePosition.divideScalar(neighbors.length)

    const attractionVector = averagePosition
      .sub(this.position)
      .normalize()
      .multiplyScalar(attractionForce)
    this.velocity.add(attractionVector)

    // Slow down the velocity
    this.velocity.multiplyScalar(0.95)
  }

  breed(neighbors: Boid[], breedingProbability: number) {
    neighbors.forEach((neighbor) => {
      if (Math.random() < breedingProbability) {
        this.genetics = BoidGenetics.breed(this.genetics, neighbor.genetics)
      }
    })
  }

  boundaries(
    boundary: THREE.Box3,
    boundaryMargin: number,
    boundaryForce: number,
    wrapAround: boolean
  ) {
    if (wrapAround) {
      this.handleWrapAround(boundary)
    } else {
      this.handleBoundaryForce(boundary, boundaryMargin, boundaryForce)
    }
  }

  private handleWrapAround(boundary: THREE.Box3) {
    if (this.position.x < boundary.min.x) this.position.x = boundary.max.x
    if (this.position.x > boundary.max.x) this.position.x = boundary.min.x
    if (this.position.y < boundary.min.y) this.position.y = boundary.max.y
    if (this.position.y > boundary.max.y) this.position.y = boundary.min.y
    if (this.position.z < boundary.min.z) this.position.z = boundary.max.z
    if (this.position.z > boundary.max.z) this.position.z = boundary.min.z
  }

  private handleBoundaryForce(
    boundary: THREE.Box3,
    boundaryMargin: number,
    boundaryForce: number
  ) {
    const isOutOfBounds =
      this.position.x < boundary.min.x + boundaryMargin ||
      this.position.x > boundary.max.x - boundaryMargin ||
      this.position.y < boundary.min.y + boundaryMargin ||
      this.position.y > boundary.max.y - boundaryMargin ||
      this.position.z < boundary.min.z + boundaryMargin ||
      this.position.z > boundary.max.z - boundaryMargin

    if (isOutOfBounds) {
      const desired = this.position
        .clone()
        .sub(boundary.getCenter(new THREE.Vector3()))
        .normalize()
        .multiplyScalar(this.genetics.maxSpeed)
      const steer = desired.clone().sub(this.velocity)
      steer.clampScalar(-boundaryForce, boundaryForce)
      this.applyForce(steer)
    }
  }
}
