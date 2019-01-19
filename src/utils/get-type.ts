export function getType(object: any) {
  return Object.prototype.toString
    .call(object)
    .match(/\s\w+/)![0]
    .trim()
}
