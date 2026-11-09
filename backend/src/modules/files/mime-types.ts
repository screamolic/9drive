const byExtension: Record<string, string> = {
  // images
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon', tif: 'image/tiff', tiff: 'image/tiff', heic: 'image/heic', heif: 'image/heif',
  // video
  mp4: 'video/mp4', m4v: 'video/x-m4v', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  mpg: 'video/mpeg', mpeg: 'video/mpeg', '3gp': 'video/3gpp', flv: 'video/x-flv', ogv: 'video/ogg', wmv: 'video/x-ms-wmv',
  // audio (Cloudinary stores audio as resource_type "video")
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', weba: 'audio/webm',
  // documents and other
  pdf: 'application/pdf', zip: 'application/zip', json: 'application/json', txt: 'text/plain', csv: 'text/csv', html: 'text/html', md: 'text/markdown',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export function extensionOf(name: string) {
  const dot = name.lastIndexOf('.')
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : ''
}

// Best-effort MIME type from a file name, used when a file is discovered on a provider instead of uploaded through the app.
export function mimeTypeFromName(name: string) {
  return byExtension[extensionOf(name)] ?? 'application/octet-stream'
}
