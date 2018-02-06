export function assert(condition: any, produceError: () => Error | string) {
  if (condition) {
    return
  }

  const error = produceError()

  if (error instanceof Error) {
    throw error
  } else if (typeof error === 'string') {
    throw new Error(error)
  }
}
