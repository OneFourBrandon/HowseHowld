const MAX_EDGE = 1600
const MAX_BYTES = 10 * 1024 * 1024

/**
 * Shrinks a camera photo to a JPEG that uploads quickly on mobile data. Photos
 * the browser cannot decode (such as HEIC outside Safari) are kept as they are.
 */
export async function preparePhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a photo.')
  let prepared = file
  if (typeof createImageBitmap === 'function' && typeof document !== 'undefined') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82))
      if (blob) prepared = new File([blob], 'photo.jpg', { type: 'image/jpeg' })
    } catch {
      prepared = file
    }
  }
  if (prepared.size > MAX_BYTES) throw new Error('That photo is over 10 MB. Try a smaller one.')
  return prepared
}
