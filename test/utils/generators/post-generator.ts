import { uuid } from '../uuid'

export default function(limit: number, belongTo: string) {
  const result: any[] = []
  const created = new Date(1970, 0, 1).toISOString()

  while (limit > 0) {
    limit--
    result.push({
      _id: uuid(),
      content: 'posts content:' + uuid(),
      belongTo,
      created,
    })
  }
  return result
}
