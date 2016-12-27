import { randomNumber } from './random'
import { uuid } from './uuid'

export const generateInvolveMembers = (limit: number, seed: string[] = []) => {
  const size = randomNumber(0, limit)
  const involves: string[] = []
  for (let i = 0; i < size; i ++) {
    involves.push(uuid())
  }
  return seed.concat(involves)
}
