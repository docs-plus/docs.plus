import { supabaseClient } from '@utils/supabase'

export const removeFileFromStorage = async (
  bucketName: string,
  filePath: string
): Promise<{ data: any; error: any }> => {
  return supabaseClient.storage.from(bucketName).remove([filePath])
}
