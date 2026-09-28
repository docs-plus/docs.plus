import { useAuthStore } from '@stores'

// While auth is still loading the answer is "not a visitor", so a signed-in user never sees a prompt flash.
export const isVisitor = (): boolean => {
  const { profile, session, loading } = useAuthStore.getState()
  return !loading && !(profile?.id ?? session?.id)
}
