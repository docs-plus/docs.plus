import { create } from 'zustand'

import createSelectors from '@utils/zustand'

const createDocMetadata = (set) => ({
  name: 'document',
  metadata: null,
  setMetadata: (metadata) => set({ metadata })
})

const useStore = create((...a) => ({
  ...createDocMetadata(...a)
}))

export default createSelectors(useStore)
