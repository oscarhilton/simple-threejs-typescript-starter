import { Engine } from '../engine/Engine'
import * as THREE from 'three'
import { Experience } from '../engine/Experience'
import { Resource } from '../engine/Resources'
import { BoidSimulation } from './BoidSimulation'

export class Demo implements Experience {
  resources: Resource[] = []
  boidSimulation: BoidSimulation
  size: number = 100

  constructor(private engine: Engine) {
    this.boidSimulation = new BoidSimulation(engine, this.size)
  }

  init() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    this.engine.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.castShadow = true
    directionalLight.position.set(2, 2, 2)
    this.engine.scene.add(directionalLight)

    this.engine.camera.instance.position.z = this.size * 3
    this.boidSimulation.init()
  }

  resize() {}

  update() {
    this.boidSimulation.update()
  }
}
