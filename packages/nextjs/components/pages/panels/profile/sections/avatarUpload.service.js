// avatarUpload.service.js
import { toast } from 'react-hot-toast'

export async function uploadAvatarToStorage(supabaseClient, bucketName, filePath, file) {
  const { data, error } = await supabaseClient.storage
    .from(bucketName)
    .upload(filePath, file)

  if (error) {
    toast.error('Failed to upload avatar.')
    throw error
  }

  return data
}

export async function updateAvatarInDB(supabaseClient, tableName, avatarUrl, userId) {
  const { data, error } = await supabaseClient
    .from(tableName)
    .update({ avatar_url: avatarUrl })
    .match({ id: userId })

  if (error) {
    toast.error('Failed to update avatar in database.')
    throw error
  }

  return data
}
