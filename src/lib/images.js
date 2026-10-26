/**
 * Compression côté navigateur avant l'envoi vers le stockage distant.
 * Les photos de téléphone (3–8 Mo) sont ramenées à ~200–600 Ko,
 * ce qui garde l'application rapide même sur réseau mobile.
 */
const MAX_DIMENSION = 1800
const QUALITY = 0.82

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Image illisible : ${file.name}`))
    }
    img.src = url
  })
}

export async function prepareImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error(`« ${file.name} » n'est pas une image.`)
  }

  let img
  try {
    img = await loadImage(file)
  } catch {
    // HEIC non décodable par le navigateur : on envoie le fichier tel quel.
    return {
      blob: file,
      width: null,
      height: null,
      mimeType: file.type || 'image/jpeg',
      extension: (file.name.split('.').pop() || 'jpg').toLowerCase(),
    }
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', QUALITY),
  )

  if (!blob) {
    return {
      blob: file,
      width,
      height,
      mimeType: file.type || 'image/jpeg',
      extension: 'jpg',
    }
  }

  return { blob, width, height, mimeType: 'image/jpeg', extension: 'jpg' }
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}
