import { Engine } from '../engine/Engine'
import * as THREE from 'three'
import { Experience } from '../engine/Experience'
import { Resource } from '../engine/Resources'
import { BoidSimulation } from './BoidSimulation'

export class Demo implements Experience {
  resources: Resource[] = []
  boidSimulation: BoidSimulation
  size: number = 300

  constructor(private engine: Engine) {
    const speedFactor = 5 // Default value, change it to control the speed
    this.boidSimulation = new BoidSimulation(engine, this.size, speedFactor)
  }

  init() {
    this.engine.scene.background = new THREE.Color(0xffffff) // Replace '0xabcdef' with the desired color in hexadecimal format

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    this.engine.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.castShadow = true
    directionalLight.position.set(2, 2, 2)
    this.engine.scene.add(directionalLight)

    this.engine.camera.instance.position.z = this.size * 1.5
    this.boidSimulation.init()
  }

  resize() {}

  update(delta: number) {
    this.boidSimulation.update(delta)
  }
}
