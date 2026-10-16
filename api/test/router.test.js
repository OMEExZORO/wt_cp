import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MethodNotAllowedError, NotFoundError } from '../src/core/errors.js'
import { del, get, group, post, Router } from '../src/core/router.js'
import { parseMiddlewareSpec } from '../src/core/pipeline.js'
import { buildRoutes } from '../src/routes.js'

const handler = () => null

describe('Router', () => {
  const router = new Router(
    group('/api/v1', [], [
      get('/health', handler),
      group('/items', ['auth'], [
        get('', handler),
        get('/{id:uuid}', handler, ['role:admin']),
        del('/{id:uuid}', handler),
        post('/search', handler),
      ]),
    ]),
  )
  const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

  it('matches static and typed parameter routes', () => {
    assert.equal(router.match('GET', '/api/v1/health').route.pattern, '/api/v1/health')
    const { route, params } = router.match('GET', `/api/v1/items/${uuid}`)
    assert.deepEqual(params, { id: uuid })
    assert.deepEqual(route.middleware, ['auth', 'role:admin'])
  })

  it('answers HEAD with the GET route', () => {
    assert.equal(router.match('HEAD', '/api/v1/health').route.method, 'GET')
  })

  it('throws 404 for unknown paths and non-uuid ids', () => {
    assert.throws(() => router.match('GET', '/api/v1/nope'), NotFoundError)
    assert.throws(() => router.match('GET', '/api/v1/items/not-a-uuid'), NotFoundError)
  })

  it('throws 405 with the allowed methods', () => {
    try {
      router.match('PUT', `/api/v1/items/${uuid}`)
      assert.fail('expected 405')
    } catch (error) {
      assert.ok(error instanceof MethodNotAllowedError)
      assert.deepEqual(error.allowed, ['GET', 'DELETE'])
    }
  })

  it('parses middleware specs', () => {
    assert.deepEqual(parseMiddlewareSpec('throttle:login,20,10'), { name: 'throttle', params: ['login', '20', '10'] })
    assert.deepEqual(parseMiddlewareSpec('auth'), { name: 'auth', params: [] })
  })

  it('builds the production route table under /api/v1 without conflicts', () => {
    const routes = buildRoutes()
    assert.ok(routes.every((route) => route.path.startsWith('/api/v1/')))
    assert.ok(routes.some((route) => route.path === '/api/v1/auth/login'))
    assert.doesNotThrow(() => new Router(routes))
  })
})
