export enum Level {
  debug = 10,
  info = 20,
  warning = 30,
  error = 40,
  test = 1000
}

export interface LoggerAdapter {
  info(...message: string[]): void
  warn(...message: string[]): void
  error(...message: string[]): void
  debug(...message: string[]): void
}

export type Formatter = (name: string, level: Level, ...message: any[]) => string

export class ContextLogger {

  public destroy = (): void => void 0
  private effects: Map<keyof LoggerAdapter, Function[]>

  constructor(
    private name: string,
    private level: Level,
    private formatter?: Formatter,
    private adapter: LoggerAdapter = console
  ) { }

  private invoke(method: string, message: any[]) {
    let output = ''
    if (this.formatter) {
      const params = [this.name, this.level].concat(message)
      output = this.formatter.apply(this, params)
    }
    this.adapter[method].call(this.adapter, output)
    const fns = (this.effects.get(method as (keyof LoggerAdapter)) || [])
    fns.forEach((fn) => fn(...message))
  }

  info(...message: any[]) {
    if (Level.info >= this.level) {
      this.invoke('info', message)
    }
  }

  warn(...message: any[]) {
    if (Level.warning >= this.level) {
      this.invoke('warn', message)
    }
  }

  error(...message: any[]) {
    if (Level.error >= this.level) {
      this.invoke('error', message)
    }
  }

  debug(...message: any[]) {
    if (Level.debug >= this.level) {
      this.invoke('debug', message)
    }
  }

  setLevel(level: Level) {
    this.level = level
  }

  replaceAdapter(adapter: LoggerAdapter) {
    if (adapter !== this.adapter) {
      this.adapter = adapter
    }
  }

  replaceFormatter(formatter: Formatter) {
    if (formatter !== this.formatter) {
      this.formatter = formatter
    }
  }

  effect(method: keyof LoggerAdapter, callback: Function) {
    if (this.effects.has(method)) {
      const fns = this.effects.get(method)!
      if (fns.every((fn) => fn !== callback)) {
        fns.push(callback)
      }
    } else {
      this.effects.set(method, [callback])
    }
  }

  clearEffects() {
    this.effects.clear()
  }

}

export class Logger {

  private static contextMap = new Map<string, ContextLogger>()
  private static defaultLevel = Level.debug
  private static outputLogger = new ContextLogger('[ReactiveDB]', Logger.defaultLevel, (name, _, message) => {
      const output = message.join('')
      const current = new Date()
      const prefix = name ? `[${name}] ` : ''
      return `${prefix}at ${current.toLocaleString()}: \r\n    ` + output
    })

  static get(name: string, formatter?: Formatter, level?: Level, adapter: LoggerAdapter = console) {
    const logger = Logger.contextMap.get(name)

    if (!logger) {
      const ctxLogger = new ContextLogger(name, level || Logger.defaultLevel, formatter, adapter)
      Logger.contextMap.set(name, ctxLogger)
      ctxLogger.destroy = () => {
        Logger.contextMap.delete(name)
        ctxLogger.clearEffects()
      }
      return ctxLogger
    }

    return logger
  }

  static setLevel(level: Level) {
    Logger.outputLogger.setLevel(level)
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
