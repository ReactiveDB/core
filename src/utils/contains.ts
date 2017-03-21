export function contains(target: any, container: Array<any> | Set<any> | Map<any, any>) {
  if (container instanceof Set || container instanceof Map) {
    return container.has(target)
  } else {
    return container.indexOf(target) > -1
  }
}
