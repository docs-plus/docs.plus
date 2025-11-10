import { supabaseClient } from '@utils/supabase'

export const uploadFileToStorage = async (
  bucketName: string,
  filePath: string,
  file: File
): Promise<{ data: any; error: any }> => {
  return supabaseClient.storage.from(bucketName).upload(filePath, file, {
    cacheControl: '3600',
    upsert: true
  })
}
