/** Black or white, whichever reads better on a colour someone picked. */
export function readableOn(color: string) {
  const hex = color.replace('#', '')
  if (!/^[\da-f]{6}$/i.test(hex)) return '#ffffff'
  const [red, green, blue] = [0, 2, 4].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16))
  return (red * 299 + green * 587 + blue * 114) / 1000 > 150 ? '#14161a' : '#ffffff'
}
