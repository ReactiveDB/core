import { uuid } from '../uuid'
import * as random from '../random'
import { EngineerSchema, ProgramSchema, ModuleSchema } from '../../index'

export default function(
  programCount: number = 1,
  moduleCount: number = 1
) {
  const engineerCount = moduleCount
  const ret: ProgramSchema[] = []

  let engineers: EngineerSchema[] = []
  let modules: ModuleSchema[] = []

  engineers = engineers.concat(Array.from({ length: engineerCount }, () => ({
    _id: uuid(),
    name: random.string()
  })))

  while (programCount--) {
    const programId = uuid()
    const remainModuleCount = (moduleCount - modules.length) / (programCount + 1)

    const pickOneEngineer = () => {
      const index = random.number(0, engineers.length - 1)
      return engineers.splice(index, 1)[0]
    }

    modules = modules.concat(Array.from({ length: remainModuleCount }, () => {
      const _owner = pickOneEngineer()

      return {
        _id: uuid(),
        name: random.string(),
        ownerId: _owner._id,
        parentId: programId,
        programmer: _owner
      }
    }))

    const modulesOfProgram = modules.filter(m => m.parentId === programId)
    const owner = modulesOfProgram[0].programmer as EngineerSchema

    ret.push({
      _id: programId,
      ownerId: owner._id,
      owner: owner,
      modules: modulesOfProgram
    })
  }

  return ret
}
