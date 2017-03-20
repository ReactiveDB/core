import { Logger } from '../shared/Logger'

const warn = (...messages: string[]) => {
  Logger.warn(...messages)
}

export { warn }
