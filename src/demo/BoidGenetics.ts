import * as THREE from 'three'

// BoidGenetics.ts
export class BoidGenetics {
  maxSpeed: number
  maxForce: number
  perceptionRadius: number
  color: THREE.Color
  reproductionPossibility: number

  constructor() {
    this.maxSpeed = 1 + Math.random() * 4 // Random value between 1 and 5
    this.maxForce = 0.1 + Math.random() * 0.6 // Random value between 0.1 and 0.5
    this.perceptionRadius = 10 + Math.random() * 40 // Random value between 10 and 50
    this.color = new THREE.Color().setHSL(Math.random(), 1.0, 0.5)
    this.reproductionPossibility = 0.01 + Math.random() * 0.04 // Random value between 0.1 and 0.5
  }

  static breed(parentA: BoidGenetics, parentB: BoidGenetics): BoidGenetics {
    const childGenetics = new BoidGenetics()

    childGenetics.maxSpeed = (parentA.maxSpeed + parentB.maxSpeed) / 2
    childGenetics.maxForce = (parentA.maxForce + parentB.maxForce) / 2
    childGenetics.perceptionRadius =
      (parentA.perceptionRadius + parentB.perceptionRadius) / 2

    return childGenetics
  }

  // Add the getFitness method
  getFitness(): number {
    // Implement your fitness calculation logic here
    const fitness = (this.maxSpeed + this.maxForce) / 2
    return fitness
  }
}
