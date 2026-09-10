export function randomRotationStart<T>(members: T[], random = Math.random): T[] {
  if (members.length < 2) return [...members]
  const start = Math.floor(random() * members.length)
  return [...members.slice(start), ...members.slice(0, start)]
}
