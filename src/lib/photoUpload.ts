/**
 * src/lib/photoUpload.ts
 *
 * Pick an image from the device library or camera, upload it to the
 * `daily-reports` Supabase Storage bucket, and return a public HTTPS URL
 * suitable for use as a LINE Flex Message hero image.
 *
 * The bucket is created by migration 007_daily_report_storage.sql and is
 * public so LINE's CDN can fetch the image without auth.
 */

import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from './supabase'

const BUCKET = 'daily-reports'

export interface PickedPhoto {
  uri: string
  width: number
  height: number
  mimeType: string
}

/** Open the native image picker (library). Returns null if the user cancels. */
export async function pickPhotoFromLibrary(): Promise<PickedPhoto | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) {
    throw new Error('Photo library permission denied')
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
    allowsEditing: false,
    exif: false,
  })
  if (result.canceled || !result.assets?.length) return null
  const asset = result.assets[0]
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    mimeType: asset.mimeType ?? 'image/jpeg',
  }
}

/** Open the native camera. Returns null if the user cancels. */
export async function takePhotoWithCamera(): Promise<PickedPhoto | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync()
  if (!perm.granted) {
    throw new Error('Camera permission denied')
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
    allowsEditing: false,
    exif: false,
  })
  if (result.canceled || !result.assets?.length) return null
  const asset = result.assets[0]
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    mimeType: asset.mimeType ?? 'image/jpeg',
  }
}

function extensionForMime(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

/**
 * Upload a picked photo to Supabase Storage and return the public URL.
 * Path layout: `{patientId}/{timestamp}.{ext}` so each patient's photos are
 * grouped — easier to find or purge later.
 */
export async function uploadPhotoForPatient(args: {
  photo: PickedPhoto
  patientId: string
}): Promise<{ publicUrl: string; storagePath: string }> {
  const ext = extensionForMime(args.photo.mimeType)
  const filename = `${Date.now()}.${ext}`
  const storagePath = `${args.patientId}/${filename}`

  // expo-image-picker returns a `file://` URI on device. The naive
  // `fetch(uri).then(r => r.blob())` pattern produces a Blob whose bytes do
  // NOT serialize correctly through React Native's bridge, and the resulting
  // upload is 0 bytes. Read the file as base64 with expo-file-system and
  // decode to a Uint8Array, which Supabase Storage can persist intact.
  const base64 = await FileSystem.readAsStringAsync(args.photo.uri, {
    encoding: FileSystem.EncodingType.Base64,
  })
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, {
      contentType: args.photo.mimeType,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Photo upload failed: ${uploadError.message}`)
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  if (!data?.publicUrl) {
    throw new Error('Could not resolve public URL for uploaded photo')
  }

  return { publicUrl: data.publicUrl, storagePath }
}
