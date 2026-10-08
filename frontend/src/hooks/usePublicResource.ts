import { useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import { loaders, type PublicKey, type PublicState } from '../features/public/publicSlice'

export function usePublicResource<K extends PublicKey>(key: K): PublicState[K] & { reload: () => void } {
  const dispatch = useAppDispatch()
  const resource = useAppSelector((state) => state.public[key])

  useEffect(() => {
    void dispatch(loaders[key]())
  }, [dispatch, key])

  const reload = useCallback(() => {
    void dispatch(loaders[key]({ force: true }))
  }, [dispatch, key])

  return { ...resource, reload }
}
