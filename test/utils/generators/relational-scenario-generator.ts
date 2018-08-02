import { uuid } from '../uuid'
import * as random from '../random'
import { EngineerSchema, ProgramSchema, ModuleSchema } from '../../index'

export default function() {
  const engineerCount = 10
  const moduleCount = 5
  const programId = uuid()

  const engineers: EngineerSchema[] = Array.from({ length: random.number(0, engineerCount) }, () => {
    return {
      _id: uuid(),
      name: random.string(),
    }
  })

  const redundantSeed = random.number(3, 7)
  const modules: ModuleSchema[] = Array.from({ length: random.number(0, moduleCount + redundantSeed) }, (_, index) => {
    return {
      _id: uuid(),
      name: random.string(),
      ownerId: engineers[random.number(0, engineers.length) - 1]._id,
      parentId: index < moduleCount ? programId : uuid(),
    }
  })

  const program: ProgramSchema = {
    _id: programId,
    ownerId: engineers[random.number(0, engineers.length) - 1]._id,
  }

  return { program, modules, engineers }
}
