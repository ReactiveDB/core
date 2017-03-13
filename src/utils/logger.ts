export enum Level {
  debug = 10,
  info = 20,
  warning = 30,
  error = 40,
  test = 1000
}

export type Formatter = (name: string, level: Level, message: string) => string

export class ContextLogger {

  constructor(
    private name: string,
    private level: Level,
    private formatter?: Formatter
  ) { }

  private invoke(method: string, message: string[]) {
    let output = message.join(' ,')
    if (this.formatter) {
      output = this.formatter(this.name, this.level, output)
    }

    console[method].call(console, output)
  }

  info(...message: string[]) {
    if (Level.info >= this.level) {
      this.invoke('info', message)
    }
  }

  warn(...message: string[]) {
    if (Level.warning >= this.level) {
      this.invoke('warn', message)
    }
  }

  error(...message: string[]) {
    if (Level.error >= this.level) {
      this.invoke('error', message)
    }
  }

  debug(...message: string[]) {
    if (Level.debug >= this.level) {
      this.invoke('debug', message)
    }
  }

  setLevel(level: Level) {
    this.level = level
  }

}

export class Logger {

  private static contextMap = new Map<string, ContextLogger>()
  private static defaultLevel = Level.debug
  private static outputLogger: ContextLogger = null

  static get(name: string, formatter?: Formatter, level?: Level) {
    const logger = Logger.contextMap.get(name)

    if (!logger) {
      const ctxLogger = new ContextLogger(name, level || Logger.defaultLevel, formatter)
      Logger.contextMap.set(name, ctxLogger)
      return ctxLogger
    }

    return logger
  }

  static setLevel(level: Level) {
    Logger.defaultLevel = level
    Logger.outputLogger = new ContextLogger(null, level, (name, _, message) => {
      const current = new Date()
      const prefix = name ? `[${name}] ` : ''
      return `${prefix}at ${current.toLocaleString()} \r\n    ` + message
    })
  }

  static warn(...message: string[]) {
    Logger.outputLogger.warn(...message)
  }

  static info(...message: string[]) {
    Logger.outputLogger.info(...message)
  }

  static debug(...message: string[]) {
    Logger.outputLogger.debug(...message)
  }

  static error(...message: string[]) {
    Logger.outputLogger.error(...message)
  }

}

const envifyLevel = () => {
  const env = (process && process.env && process.env.NODE_ENV) || 'production'

  switch (env) {
    case 'production':
      return Level.error
    case 'test':
      return Level.test
    default:
      return Level.debug
  }
}

Logger.setLevel(envifyLevel())
