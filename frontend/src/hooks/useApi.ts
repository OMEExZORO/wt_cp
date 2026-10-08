import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/client'

export interface ApiState<T> {
  data: T | null
  error: ApiError | null
  loading: boolean
}

export function useApi<T, A extends unknown[] = []>(request: (...args: A) => Promise<T>) {
  const [state, setState] = useState<ApiState<T>>({ data: null, error: null, loading: false })
  const mounted = useRef(true)
  const requestRef = useRef(request)
  requestRef.current = request

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const run = useCallback(async (...args: A): Promise<T | null> => {
    setState((previous) => ({ ...previous, loading: true, error: null }))
    try {
      const data = await requestRef.current(...args)
      if (mounted.current) {
        setState({ data, error: null, loading: false })
      }
      return data
    } catch (cause) {
      const error = cause instanceof ApiError ? cause : new ApiError(0, 'SERVER_ERROR', 'Something went wrong. Please try again.')
      if (mounted.current) {
        setState({ data: null, error, loading: false })
      }
      return null
    }
  }, [])

  return { ...state, run }
}

export function useApiQuery<T>(request: () => Promise<T>, deps: unknown[] = []) {
  const { run, ...state } = useApi(request)
  useEffect(() => {
    void run()
  }, deps)
  return { ...state, reload: run }
}
