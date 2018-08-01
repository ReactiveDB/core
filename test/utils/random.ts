export function rnd(percent: number) {
  if (percent > 100 || percent < 0) {
    throw new TypeError(`Invaild percent`)
  }
  const judge = Math.ceil(Math.random() * 100)
  return judge < percent
}

export function number(from: number, to: number) {
  return parseInt(from as any) + Math.ceil(Math.random() * (to - from))
}

export function string(length: number = 10) {
  return Math.random()
    .toString(36)
    .substr(2, length)
}
