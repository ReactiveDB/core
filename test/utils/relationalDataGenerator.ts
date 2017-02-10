import { uuid } from './uuid'
import { randomNumber, randomString } from './random'
import { EngineerSchema, ProgramSchema, ModuleSchema } from '../index'

export default function() {

  const engineerCount = 10
  const moduleCount = 5
  const programId = uuid()

  const engineers: EngineerSchema[] = Array.from({ length: randomNumber(0, engineerCount) }, () => {
    return {
      _id: uuid(),
      name: randomString()
    }
  })

  const redundantSeed = randomNumber(3, 7)
  const modules: ModuleSchema[] = Array.from({ length: randomNumber(0, moduleCount + redundantSeed) }, (_, index) => {
    return {
      _id: uuid(),
      name: randomString(),
      ownerId: engineers[randomNumber(0, engineers.length) - 1]._id,
      parentId: index < moduleCount ? programId : uuid()
    }
  })

  const program: ProgramSchema = {
    _id: programId,
    ownerId: engineers[randomNumber(0, engineers.length) - 1]._id
  }

  return { program, modules, engineers }
}

export function ProgramGenerator(
  programCount: number = 1,
  moduleCount: number = 1
) {
  const engineerCount = moduleCount
  const ret: ProgramSchema[] = []

  let engineers: EngineerSchema[] = []
  let modules: ModuleSchema[] = []

  engineers = engineers.concat(Array.from({ length: engineerCount }, () => ({
    _id: uuid(),
    name: randomString()
  })))

  while (programCount--) {
    const programId = uuid()
    const remainModuleCount = (moduleCount - modules.length) / (programCount + 1)

    const pickOneEngineer = () => {
      const index = randomNumber(0, engineers.length - 1)
      return engineers.splice(index, 1)[0]
    }

    modules = modules.concat(Array.from({ length: remainModuleCount }, () => {
      const owner = pickOneEngineer()

      return {
        _id: uuid(),
        name: randomString(),
        ownerId: owner._id,
        parentId: programId,
        programmer: owner
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
