import { supabase } from './supabase'

export interface UploadedMediaRecord {
  id: string
  storagePath: string
  fileName: string
  mimeType: string
  fileSizeBytes: number
  width?: number
  height?: number
  durationSeconds?: number
  previewUrl: string
}

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

export async function extractMediaDimensions(file: File): Promise<{
  width?: number
  height?: number
  durationSeconds?: number
}> {
  return new Promise((resolve) => {
    if (file.type.startsWith('image/')) {
      const img = new Image()
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
      }
      img.onerror = () => resolve({})
      img.src = URL.createObjectURL(file)
    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          durationSeconds: Math.round(video.duration),
        })
      }
      video.onerror = () => resolve({})
      video.src = URL.createObjectURL(file)
    } else {
      resolve({})
    }
  })
}

export async function uploadMediaFile(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadedMediaRecord> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 50 MB limit for the Supabase free plan.`
    )
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Please sign in to upload media files.')
  }

  onProgress?.(15)

  // Extract dimensions and video length in the browser
  const dimensions = await extractMediaDimensions(file)
  onProgress?.(30)

  // Unique sanitized storage path: {user_id}/{timestamp}_{filename}
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${user.id}/${Date.now()}_${cleanName}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`)
  }

  onProgress?.(75)

  // Create 1-hour signed URL for private preview & platform fetch
  const { data: signedData, error: signedError } = await supabase.storage
    .from('media')
    .createSignedUrl(storagePath, 3600)

  const previewUrl = signedData?.signedUrl || URL.createObjectURL(file)

  // Insert metadata record into media table
  const { data: mediaRecord, error: dbError } = await supabase
    .from('media')
    .insert({
      user_id: user.id,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
      width: dimensions.width || null,
      height: dimensions.height || null,
      duration_seconds: dimensions.durationSeconds || null,
    })
    .select('id')
    .single()

  if (dbError) {
    console.warn('Could not insert media table metadata:', dbError.message)
  }

  onProgress?.(100)

  return {
    id: mediaRecord?.id || crypto.randomUUID(),
    storagePath,
    fileName: file.name,
    mimeType: file.type,
    fileSizeBytes: file.size,
    width: dimensions.width,
    height: dimensions.height,
    durationSeconds: dimensions.durationSeconds,
    previewUrl,
  }
}
