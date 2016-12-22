import { uuid } from './uuid'

export default function (limit: number, belongTo: string) {
  const result: any[] = []
  while (limit > 0) {
    limit --
    result.push({
      _id: uuid(),
      content: 'posts content:' + uuid(),
      belongTo
    })
  }
  return result
}
