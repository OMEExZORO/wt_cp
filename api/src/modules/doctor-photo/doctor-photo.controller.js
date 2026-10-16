import path from 'node:path'
import { NotFoundError } from '../../core/errors.js'
import { requireUser } from '../../core/http.js'
import { ApiResponse, noContent, ok } from '../../core/response.js'
import { ImageUploadStore, MAX_BYTES } from '../../services/admin/image-upload-store.js'
import { storageRoot } from '../../services/storage/index.js'
import { parseMultipart } from '../../services/uploads.js'

export const SETTING_KEY = 'doctor.photo_url'

const imageStore = (app) => new ImageUploadStore(path.join(storageRoot(app.config), 'uploads', 'doctor'))

const writeSetting = (app, value, placeholder, userId) =>
  app.db.execute('UPDATE site_settings SET value = $1, is_placeholder = $2, updated_by_user_id = $3 WHERE key = $4', [
    value,
    placeholder,
    userId,
    SETTING_KEY,
  ])

export const show = async (_req, app) => {
  const current = await imageStore(app).current()
  if (current === null) throw new NotFoundError('No doctor photo has been uploaded.')
  return ApiResponse.binary(current.body, 200, {
    'Content-Type': current.mime,
    'Cache-Control': 'public, max-age=86400',
    'Content-Length': String(current.body.length),
    'Cross-Origin-Resource-Policy': 'cross-origin',
  })
}

export const upload = async (req, app) => {
  const { files } = await parseMultipart(req, { maxFileBytes: MAX_BYTES })
  const stored = await imageStore(app).save(files.photo ?? null, 'photo')
  const url = `${String(app.config.url).replace(/\/+$/, '')}/api/v1/public/doctor/photo?v=${Math.floor(Date.now() / 1000)}`
  const actor = requireUser(req)
  await writeSetting(app, url, false, String(actor.id))
  await app.audit.log('admin.doctor_photo_uploaded', req, {
    entity_type: 'site_settings',
    entity_id: SETTING_KEY,
    metadata: { mime: stored.mime, bytes: stored.bytes },
  })
  return ok({ photo_url: url })
}

export const destroy = async (req, app) => {
  await imageStore(app).clear()
  const actor = requireUser(req)
  await writeSetting(app, null, true, String(actor.id))
  await app.audit.log('admin.doctor_photo_removed', req, { entity_type: 'site_settings', entity_id: SETTING_KEY, metadata: {} })
  return noContent()
}
