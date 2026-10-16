import path from 'node:path'
import { envString, requireEnv } from '../../core/env.js'
import { LocalStorage } from './local-storage.js'
import { SupabaseStorage } from './supabase-storage.js'

export const storageRoot = (config, source = process.env) => envString('STORAGE_ROOT', config.storagePath, source)

export const createStorage = (config, source = process.env) => {
  if (envString('STORAGE_DRIVER', 'local', source) === 'supabase') {
    return new SupabaseStorage({
      baseUrl: requireEnv('SUPABASE_URL', source),
      serviceKey: requireEnv('SUPABASE_SERVICE_KEY', source),
      bucket: config.storageBucket,
    })
  }
  return new LocalStorage(path.join(storageRoot(config, source), 'reports'))
}

export { LocalStorage, SupabaseStorage }
