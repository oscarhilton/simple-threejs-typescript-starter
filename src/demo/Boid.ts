// Boid.ts
import * as THREE from 'three'
import { Box } from './Box'
import { BoidGenetics } from './BoidGenetics'
import { Vector3 } from 'three'

export class Boid extends Box {
  velocity: THREE.Vector3
  acceleration: THREE.Vector3
  position: THREE.Vector3
  genetics: BoidGenetics
  target: THREE.Vector3
  reachedTarget: boolean = false
  public seeking = false
  startPos: THREE.Vector3

  constructor(
    pos: THREE.Vector3,
    target: THREE.Vector3,
    targetColor: THREE.Color
  ) {
    const genetics = new BoidGenetics()
    super(targetColor, null, genetics.size)

    this.genetics = genetics

    this.target = target
    this.startPos = pos

    this.applyColorFromGenetics()

    this.velocity = this.getRandomVelocity()
    this.acceleration = new THREE.Vector3()
    this.position = new THREE.Vector3().copy(pos)
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
    if (!this.acceleration) {
      return new THREE.Vector3()
    }
    this.acceleration.multiplyScalar(0)
    const maxSpeed = this.genetics.maxSpeed
    return new THREE.Vector3(
      Math.random() * maxSpeed - maxSpeed / 2,
      Math.random() * maxSpeed - maxSpeed / 2,
      Math.random() * maxSpeed - maxSpeed / 2
    )
  }

  update(
    delta: number,
    boundary: THREE.Box3,
    maxSpeedScale: number = 2, // Increase maxSpeedScale
    distanceRadius: number = 1
  ) {
    const accelerationScale = 0.5 // Increase accelerationScale

    // Normalize the acceleration vector and multiply it by a constant
    if (this.acceleration.length() > 0) {
      this.acceleration.normalize().multiplyScalar(accelerationScale)
    }

    // Calculate the distance to the target
    const distanceToTarget = this.position.distanceTo(this.target)

    // Use cubic easing to slow the boid down as it approaches the target
    const decelerationDistance = Math.max(distanceRadius, 5)
    const easedDistance =
      distanceToTarget < decelerationDistance
        ? Math.pow(distanceToTarget / decelerationDistance, 3)
        : 1

    // Calculate the maximum velocity
    const maxVelocity = Math.max(
      this.genetics.maxForce,
      maxSpeedScale * easedDistance
    )

    // Update the velocity and position
    this.velocity
      .add(this.acceleration)
      .normalize()
      .multiplyScalar(maxSpeedScale * easedDistance)
    this.velocity.clampLength(-maxVelocity, maxVelocity)

    this.position.add(this.velocity.clone().multiplyScalar(delta))
  }

  applyForce(force: THREE.Vector3) {
    this.acceleration.add(force).multiplyScalar(this.genetics.maxSpeed * 2)
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

  applyBoundaryForce(
    boundary: THREE.Box3,
    buffer: number,
    forceMultiplier: number = 1
  ) {
    const force = new THREE.Vector3()

    if (this.position.x < boundary.min.x + buffer) {
      force.x = forceMultiplier
    } else if (this.position.x > boundary.max.x - buffer) {
      force.x = -forceMultiplier
    }

    if (this.position.y < boundary.min.y + buffer) {
      force.y = forceMultiplier
    } else if (this.position.y > boundary.max.y - buffer) {
      force.y = -forceMultiplier
    }

    if (this.position.z < boundary.min.z + buffer) {
      force.z = forceMultiplier
    } else if (this.position.z > boundary.max.z - buffer) {
      force.z = -forceMultiplier
    }

    this.acceleration.add(force)
  }

  flock(
    boids: Boid[],
    separationWeight: number,
    alignmentWeight: number,
    cohesionWeight: number
  ) {
    const separation = this.separate(boids)
    const alignment = this.align(boids)
    const cohesion = this.cohere(boids)

    separation.multiplyScalar(separationWeight)
    alignment.multiplyScalar(alignmentWeight)
    cohesion.multiplyScalar(cohesionWeight)

    const allForces = new Vector3()

    allForces.add(separation)
    allForces.add(alignment)
    allForces.add(cohesion)

    const collision = this.handleCollision(boids, this.genetics.size)

    allForces.add(collision)

    return allForces
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

    return repulsionForce
  }

  applyRandomForce(forceScale: number = 1) {
    const randomForce = new THREE.Vector3(
      (Math.random() - 0.5) * forceScale,
      (Math.random() - 0.5) * forceScale,
      (Math.random() - 0.5) * forceScale
    )

    this.applyForce(randomForce.multiplyScalar(10))
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

  attractToTarget(
    boids,
    decelerationDistance: number = 5,
    attractionForceScale: number = 5000 // Increase this value for a stronger attraction force
  ) {
    const desired = this.target.clone().sub(this.position)
    const distance = desired.length()
    const steering = desired.clone().sub(this.velocity)

    // Cubic ease in and out function
    function easeInOutCubic(t: number) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    }

    // Calculate easing based on distance
    const easedDistance = easeInOutCubic(
      Math.min(distance / decelerationDistance, distance * 0.3)
    )

    const collision = this.handleCollision(boids, this.genetics.size)

    steering.add(collision)

    steering.normalize().multiplyScalar(easedDistance * attractionForceScale)

    return steering
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
