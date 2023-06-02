import { toast } from 'react-hot-toast'

const uploadAvatarToStorage = async (supabaseClient, bucketName, filePath, file) => {
  try {
    const { error, data } = await supabaseClient.storage.from(bucketName).upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    })
    if (error) {
      toast.error('Failed to upload avatar')
      throw error
    }
    return data
  } catch (error) {
    toast.error('Failed to upload avatar')
  }
}

const removeAvatarFromStorage = async (supabaseClient, bucketName, filePath) => {
  try {
    const { error, data } = await supabaseClient.storage.from(bucketName).remove([filePath])
    if (error) {
      toast.error('Failed to remove avatar')
      throw error
    }
    return data
  } catch (error) {
    toast.error('Failed to remove avatar')
  }
}

const updateAvatarInDB = async (supabaseClient, tableName, avatarUrl, userId) => {
  try {
    const { error, data } = await supabaseClient.from(tableName).update({ avatar_url: avatarUrl }).match({ id: userId })
    if (error) {
      toast.error('Failed to update avatar in database.')
      throw error
    }
    return data
  } catch (error) {
    toast.error('Failed to update avatar in database.')
  }
}
export { updateAvatarInDB, uploadAvatarToStorage, removeAvatarFromStorage }
