import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { describe, it } from 'node:test'
import { EncryptionError } from '../src/core/errors.js'
import { EncryptionService } from '../src/services/encryption.js'
import { hashPassword, needsRehash, verifyPassword } from '../src/services/password-hasher.js'

const KEY_ONE = `base64:${Buffer.alloc(32, 'A').toString('base64')}`
const KEY_TWO = `base64:${Buffer.alloc(32, 'B').toString('base64')}`

const PHP_HASH = '$argon2id$v=19$m=65536,t=4,p=1$eFdValZtaHlWUW56NWJhRw$+lDJfxIlJZH54BU9YHzR5y2zvEpXk1OWW9ldrW/n7pQ'
const PHP_ENVELOPE_V1 = 'dc:v1:Tu6XNSHyrNaKJHLq:pS33Thpll+u7g42iDb9Kpg==:Br2Jit1F4t5kx73CeQOocUClljFdJ7hoGAUw9g=='
const PHP_ENVELOPE_V2 = 'dc:v2:cu2IlX/8KdpPbVbi:/GN8gc0eydRm92JKR/vJVA==:BzTmearVbDYiPiuG3vhk'

describe('password hashing compatibility', () => {
  it('verifies hashes produced by PHP password_hash(PASSWORD_ARGON2ID)', async () => {
    assert.equal(await verifyPassword('Correct-Horse-9', PHP_HASH), true)
    assert.equal(await verifyPassword('correct-horse-9', PHP_HASH), false)
    assert.equal(needsRehash(PHP_HASH), false)
  })

  it('produces PHC strings in the parameter order PHP expects', async () => {
    const hash = await hashPassword('Another-Pass-1!')
    assert.match(hash, /^\$argon2id\$v=19\$m=65536,t=4,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/)
    assert.equal(await verifyPassword('Another-Pass-1!', hash), true)
    assert.equal(await verifyPassword('wrong', hash), false)
  })

  it('flags weaker or foreign hashes for rehash and rejects garbage', async () => {
    assert.equal(needsRehash('$argon2id$v=19$m=1024,t=1,p=1$c29tZXNhbHQ$aGFzaA'), true)
    assert.equal(needsRehash('$2y$10$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz01234'), true)
    assert.equal(await verifyPassword('x', 'not-a-hash'), false)
    assert.equal(await verifyPassword('x', null), false)
  })

  it('is accepted by PHP password_verify when php is available', async (t) => {
    const probe = spawnSync('php', ['-r', 'echo 1;'], { encoding: 'utf8' })
    if (probe.status !== 0) return t.skip('php not available')
    const hash = await hashPassword('Cross-Check-7#x')
    const result = spawnSync('php', ['-r', 'echo password_verify("Cross-Check-7#x", $argv[1]) ? "yes" : "no";', hash], { encoding: 'utf8' })
    assert.equal(result.stdout, 'yes')
  })
})

describe('EncryptionService compatibility', () => {
  const service = new EncryptionService(KEY_TWO, 2, { 1: KEY_ONE })

  it('decrypts envelopes sealed by PHP, including previous key versions', () => {
    assert.equal(service.decryptText(PHP_ENVELOPE_V1), 'critical finding: 7mm nodule')
    assert.equal(service.decryptText(PHP_ENVELOPE_V2), 'hello ünïcode')
    assert.equal(service.envelopeVersion(PHP_ENVELOPE_V1), 1)
  })

  it('decrypts raw PHP payloads with additional authenticated data', () => {
    const plain = service.decrypt(
      Buffer.from('45dusm1QnjxL', 'base64'),
      Buffer.from('B0KpaQPZwl1SSLHI', 'base64'),
      Buffer.from('fxTPTtz67Px5DlaW0T8EpA==', 'base64'),
      1,
      Buffer.from('aad'),
    )
    assert.equal(plain.toString(), 'raw-bytes')
    assert.throws(
      () => service.decrypt(Buffer.from('45dusm1QnjxL', 'base64'), Buffer.from('B0KpaQPZwl1SSLHI', 'base64'), Buffer.from('fxTPTtz67Px5DlaW0T8EpA==', 'base64'), 1),
      EncryptionError,
    )
  })

  it('round-trips with the current key version and rejects tampering', () => {
    const envelope = service.encryptText('secret')
    assert.match(envelope, /^dc:v2:[^:]+:[^:]+:[^:]+$/)
    assert.equal(service.decryptText(envelope), 'secret')
    const parts = envelope.split(':')
    parts[4] = Buffer.from('tampered').toString('base64')
    assert.throws(() => service.decryptText(parts.join(':')), EncryptionError)
    assert.throws(() => service.decryptText('dc:v9:AA==:AA==:AA=='), EncryptionError)
    assert.throws(() => service.decryptText('garbage'), EncryptionError)
  })

  it('parses ENCRYPTION_KEYS_PREVIOUS from the environment', () => {
    const fromEnv = EncryptionService.fromEnv({
      ENCRYPTION_KEY: KEY_TWO,
      ENCRYPTION_KEY_VERSION: '2',
      ENCRYPTION_KEYS_PREVIOUS: `1=${KEY_ONE}`,
    })
    assert.equal(fromEnv.decryptText(PHP_ENVELOPE_V1), 'critical finding: 7mm nodule')
    assert.throws(() => EncryptionService.fromEnv({ ENCRYPTION_KEY: KEY_TWO, ENCRYPTION_KEYS_PREVIOUS: 'bad' }), EncryptionError)
  })

  it('validates keys and nullable helpers', () => {
    assert.throws(() => new EncryptionService('nope'), EncryptionError)
    assert.throws(() => new EncryptionService(`base64:${Buffer.alloc(8).toString('base64')}`), EncryptionError)
    assert.equal(service.encryptNullable(''), null)
    assert.equal(service.decryptNullable(null), null)
  })
})
