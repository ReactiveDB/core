import * as random from '../random'
import { uuid } from '../uuid'

export default function (limit: number, seed: string[] = []) {
  const size = random.number(0, limit)
  const involves: string[] = []
  for (let i = 0; i < size; i ++) {
    involves.push(uuid())
  }
  return seed.concat(involves)
}
