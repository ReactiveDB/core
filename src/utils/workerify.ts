export const workify = (fn: Function) => {
  if (process.env.NODE_ENV === 'test') {
    return Object.create({
      postMessage: (data: any) => {
        fn({ data })
      },
      terminate: (): any => void 0,
    }) as Worker
  }

  const blob = new Blob(['self.onmessage = ', fn.toString()], { type: 'text/javascript' })
  const url = URL.createObjectURL(blob)
  const thread = new Worker(url)
  URL.revokeObjectURL(url)
  return thread
}
