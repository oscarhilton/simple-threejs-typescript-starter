import * as THREE from 'three'
import vertexShader from './shader.vert'
import fragmentShader from './shader.frag'

export class Box extends THREE.Mesh {
  constructor(color: THREE.Color, resizedTexture: any, size: number) {
    const geometry = new THREE.SphereGeometry(size)
    const material = new THREE.ShaderMaterial({
      uniforms: {
        imageTexture: { value: resizedTexture },
        targetColor: { value: color },
      },
      vertexShader,
      fragmentShader,
    })

    super(geometry, material)
  }
}
