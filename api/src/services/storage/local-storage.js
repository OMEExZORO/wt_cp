import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { StorageError } from '../../core/errors.js'
import { assertValidPath } from './storage-service.js'

export class LocalStorage {
  constructor(root) {
    this.root = root
  }

  resolve(relative) {
    assertValidPath(relative)
    return path.join(this.root.replace(/[/\\]+$/, ''), ...relative.split('/'))
  }

  async put(relative, contents) {
    const target = this.resolve(relative)
    try {
      await mkdir(path.dirname(target), { recursive: true, mode: 0o700 })
    } catch {
      throw new StorageError('Could not create the storage directory.')
    }
    try {
      await writeFile(target, contents, { flag: 'wx', mode: 0o600 })
    } catch {
      throw new StorageError('Could not store the file.')
    }
  }

  async get(relative) {
    const target = this.resolve(relative)
    try {
      return await readFile(target)
    } catch {
      throw new StorageError('Stored file is missing.')
    }
  }

  async delete(relative) {
    const target = this.resolve(relative)
    try {
      await unlink(target)
    } catch (error) {
      if (error.code !== 'ENOENT') throw new StorageError('Could not delete the stored file.')
    }
  }

  driver() {
    return 'local'
  }
}
