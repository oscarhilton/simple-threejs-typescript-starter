import * as THREE from 'three'
import { Boid } from './Boid'

export class SpatialGrid {
  private grid: Map<string, Boid[]>
  private cellSize: number

  constructor(cellSize: number) {
    this.grid = new Map<string, Boid[]>()
    this.cellSize = cellSize
  }

  private getGridKey(position: THREE.Vector3): string {
    const x = Math.floor(position.x / this.cellSize)
    const y = Math.floor(position.y / this.cellSize)
    const z = Math.floor(position.z / this.cellSize)
    return `${x},${y},${z}`
  }

  insert(boid: Boid) {
    const key = this.getGridKey(boid.position)
    if (this.grid.has(key)) {
      this.grid.get(key)!.push(boid)
    } else {
      this.grid.set(key, [boid])
    }
  }

  query(position: THREE.Vector3, radius: number): Boid[] {
    const nearbyBoids: Boid[] = []
    const minX = Math.floor((position.x - radius) / this.cellSize)
    const maxX = Math.floor((position.x + radius) / this.cellSize)
    const minY = Math.floor((position.y - radius) / this.cellSize)
    const maxY = Math.floor((position.y + radius) / this.cellSize)
    const minZ = Math.floor((position.z - radius) / this.cellSize)
    const maxZ = Math.floor((position.z + radius) / this.cellSize)

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const key = `${x},${y},${z}`
          if (this.grid.has(key)) {
            for (const boid of this.grid.get(key)!) {
              if (position.distanceTo(boid.position) <= radius) {
                nearbyBoids.push(boid)
              }
            }
          }
        }
      }
    }

    return nearbyBoids
  }

  clear() {
    this.grid.clear()
  }

  remove(boid: Boid) {
    const key = this.getGridKey(boid.position)
    const cell = this.grid.get(key)

    if (cell) {
      const index = cell.indexOf(boid)
      if (index > -1) {
        cell.splice(index, 1)

        if (cell.length === 0) {
          this.grid.delete(key)
        }
      }
    }
  }
}
