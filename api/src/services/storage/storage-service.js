import { StorageError } from '../../core/errors.js'

export const PATH_PATTERN = /^[a-z0-9][a-z0-9/_-]*\.bin$/

export const assertValidPath = (path) => {
  if (!PATH_PATTERN.test(path) || path.includes('..')) throw new StorageError('Invalid storage path.')
}
