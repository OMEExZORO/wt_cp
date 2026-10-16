import { MethodNotAllowedError, NotFoundError } from './errors.js'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

const PARAM_TYPES = {
  uuid: '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
  int: '[0-9]+',
  slug: '[a-z0-9]+(?:-[a-z0-9]+)*',
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

const define = (method, path, handler, middleware = []) => ({ method, path, handler, middleware })

export const get = (path, handler, middleware) => define('GET', path, handler, middleware)
export const post = (path, handler, middleware) => define('POST', path, handler, middleware)
export const put = (path, handler, middleware) => define('PUT', path, handler, middleware)
export const patch = (path, handler, middleware) => define('PATCH', path, handler, middleware)
export const del = (path, handler, middleware) => define('DELETE', path, handler, middleware)

export const joinPath = (prefix, path) => {
  const full = `${prefix}/${path}`.replace(/\/{2,}/g, '/')
  const trimmed = full.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

export const group = (prefix, middleware, routes) =>
  routes.flat(Infinity).map((route) => ({
    ...route,
    path: joinPath(prefix, route.path),
    middleware: [...middleware, ...route.middleware],
  }))

export class Route {
  constructor({ method, path, handler, middleware }) {
    if (!METHODS.includes(method)) throw new Error(`Unsupported HTTP method ${method}`)
    this.method = method
    this.pattern = path
    this.handler = handler
    this.middleware = middleware
    this.paramNames = []
    this.regex = this.compile(path)
  }

  compile(pattern) {
    const parts = pattern.split(/(\{[a-zA-Z_][a-zA-Z0-9_]*(?::[a-z]+)?\})/).filter((part) => part !== '')
    let source = ''
    for (const part of parts) {
      const match = /^\{([a-zA-Z_][a-zA-Z0-9_]*)(?::([a-z]+))?\}$/.exec(part)
      if (!match) {
        source += escapeRegex(part)
        continue
      }
      const [, name, type] = match
      if (type !== undefined && !PARAM_TYPES[type]) throw new Error(`Unknown route parameter type ${type}`)
      this.paramNames.push(name)
      source += `(?<${name}>${type === undefined ? '[^/]+' : PARAM_TYPES[type]})`
    }
    return new RegExp(`^${source}$`)
  }

  match(path) {
    const result = this.regex.exec(path)
    if (result === null) return null
    const params = {}
    for (const name of this.paramNames) {
      try {
        params[name] = decodeURIComponent(result.groups[name])
      } catch {
        params[name] = result.groups[name]
      }
    }
    return params
  }
}

export class Router {
  constructor(definitions = []) {
    this.routes = definitions.flat(Infinity).map((definition) => new Route(definition))
  }

  match(method, path) {
    const verb = method.toUpperCase()
    const lookup = verb === 'HEAD' ? 'GET' : verb
    const allowed = []
    for (const route of this.routes) {
      const params = route.match(path)
      if (params === null) continue
      if (route.method === lookup) return { route, params }
      allowed.push(route.method)
    }
    if (allowed.length > 0) throw new MethodNotAllowedError([...new Set(allowed)])
    throw new NotFoundError('The requested endpoint does not exist.')
  }
}
