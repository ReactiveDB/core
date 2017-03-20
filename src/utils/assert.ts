export function assert(condition: any, error: Error | string) {
  if (condition) {
    return
  }

  if (error instanceof Error) {
    throw error
  } else if (typeof error === 'string') {
    throw new Error(error)
  }
}
