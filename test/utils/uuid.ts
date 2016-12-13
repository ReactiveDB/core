const s4 = () => Math.floor(
  (1 + Math.random()) * 0x10000
)
  .toString(16)
  .substring(1)

const uuidStack = new Set<string>()

export const uuid = () => {
  let UUID = s4() + s4()
  /* istanbul ignore next */
  while (uuidStack.has(UUID)) {
    UUID = s4() + s4()
  }
  uuidStack.add(UUID)
  return UUID
}
