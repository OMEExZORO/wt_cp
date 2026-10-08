import { createAsyncThunk, createSlice, type AsyncThunk, type ThunkAction, type UnknownAction } from '@reduxjs/toolkit'
import { ApiError } from '../../api/client'
import { publicApi } from '../../api/public'
import type { RootState } from '../../app/store'
import type {
  BranchesResponse,
  FaqsResponse,
  ReviewsResponse,
  ScanCategoriesResponse,
  ScanTypesResponse,
  SettingEntry,
  SettingsMap,
  SiteSettingsResponse,
} from '../../types/public'

export type ResourceStatus = 'idle' | 'loading' | 'succeeded' | 'failed'

export interface Resource<T> {
  data: T | null
  status: ResourceStatus
  error: string | null
}

export interface PublicState {
  site: Resource<SiteSettingsResponse>
  branches: Resource<BranchesResponse>
  scanTypes: Resource<ScanTypesResponse>
  categories: Resource<ScanCategoriesResponse>
  faqs: Resource<FaqsResponse>
  reviews: Resource<ReviewsResponse>
}

export type PublicKey = keyof PublicState

function empty<T>(): Resource<T> {
  return { data: null, status: 'idle', error: null }
}

const initialState: PublicState = {
  site: empty(),
  branches: empty(),
  scanTypes: empty(),
  categories: empty(),
  faqs: empty(),
  reviews: empty(),
}

export interface LoadArg {
  force?: boolean
}

type LoaderConfig = { state: RootState; rejectValue: string }

function message(cause: unknown): string {
  return cause instanceof ApiError ? cause.message : 'Something went wrong. Please try again.'
}

function makeLoader<T>(key: PublicKey, fetcher: () => Promise<T>) {
  return createAsyncThunk<T, LoadArg | undefined, LoaderConfig>(
    `public/${key}`,
    async (_arg, { rejectWithValue }) => {
      try {
        return await fetcher()
      } catch (cause) {
        return rejectWithValue(message(cause))
      }
    },
    {
      condition: (arg, { getState }) => {
        const status = getState().public[key].status
        if (status === 'loading') {
          return false
        }
        return arg?.force === true || status === 'idle' || status === 'failed'
      },
    },
  )
}

export const loadSite = makeLoader('site', publicApi.site)
export const loadBranches = makeLoader('branches', publicApi.branches)
export const loadScanTypes = makeLoader('scanTypes', () => publicApi.scanTypes())
export const loadCategories = makeLoader('categories', () => publicApi.scanCategories())
export const loadFaqs = makeLoader('faqs', publicApi.faqs)
export const loadReviews = makeLoader('reviews', () => publicApi.reviews(12))

export type Loader = (arg?: LoadArg) => ThunkAction<unknown, RootState, undefined, UnknownAction>

export const loaders: Record<PublicKey, Loader> = {
  site: loadSite,
  branches: loadBranches,
  scanTypes: loadScanTypes,
  categories: loadCategories,
  faqs: loadFaqs,
  reviews: loadReviews,
}

const slice = createSlice({
  name: 'public',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    const attach = <K extends PublicKey>(
      key: K,
      thunk: AsyncThunk<NonNullable<PublicState[K]['data']>, LoadArg | undefined, LoaderConfig>,
    ) => {
      builder
        .addCase(thunk.pending, (state) => {
          state[key].status = 'loading'
          state[key].error = null
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state[key].status = 'succeeded'
          state[key].data = action.payload as never
        })
        .addCase(thunk.rejected, (state, action) => {
          state[key].status = 'failed'
          state[key].error = action.payload ?? 'Something went wrong. Please try again.'
        })
    }
    attach('site', loadSite)
    attach('branches', loadBranches)
    attach('scanTypes', loadScanTypes)
    attach('categories', loadCategories)
    attach('faqs', loadFaqs)
    attach('reviews', loadReviews)
  },
})

export default slice.reducer

export const selectSettings = (state: RootState): SettingsMap => state.public.site.data?.settings ?? {}

export function selectSetting(key: string) {
  return (state: RootState): SettingEntry | undefined => state.public.site.data?.settings[key]
}
