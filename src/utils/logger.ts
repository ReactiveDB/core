export enum Level {
  debug = 10,
  info = 20,
  warning = 30,
  error = 40
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

}

export class Logger {

  private static contextMap = new Map<string, ContextLogger>()
  private static level = Level.debug
  private static outputLogger: ContextLogger = null

  static get(name: string, formatter?: Formatter) {
    const logger = Logger.contextMap.get(name)

    if (!logger) {
      const instance = new ContextLogger(name, Logger.level, formatter)
      Logger.contextMap.set(name, instance)
      return instance
    }

    return logger
  }

  static setLevel(level: Level) {
    this.level = level
    this.outputLogger = new ContextLogger(null, level, (name, _, message) => {
      const current = new Date()
      const prefix = name ? `[${name}] ` : ''
      return `${prefix}at ${current.toLocaleString()} \r\n    ` + message
    })
  }

  static warn(...message: string[]) {
    this.outputLogger.warn(...message)
  }

  static info(...message: string[]) {
    this.outputLogger.info(...message)
  }

  static debug(...message: string[]) {
    this.outputLogger.debug(...message)
  }

  static error(...message: string[]) {
    this.outputLogger.error(...message)
  }

}

const envifyLevel = () => {
  const isProduction = (process && process.env && process.env.NODE_ENV) === 'production'
  return isProduction ? Level.error : Level.debug
}

Logger.setLevel(envifyLevel())
