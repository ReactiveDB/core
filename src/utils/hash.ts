export const hash = (str: string) => {
  let ret = 0
  for (let i = 0; i < str.length; i++) {
    ret = (ret << 5) - ret + str.charCodeAt(i)
    ret = ret & ret
  }
  return ret
}
