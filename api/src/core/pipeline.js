export const compose = (middlewares, destination) =>
  middlewares.reduceRight(
    (next, middleware) => (req) => middleware(req, next),
    destination,
  )

export const parseMiddlewareSpec = (spec) => {
  const index = spec.indexOf(':')
  if (index === -1) return { name: spec, params: [] }
  const params = spec
    .slice(index + 1)
    .split(',')
    .map((param) => param.trim())
    .filter((param) => param !== '')
  return { name: spec.slice(0, index), params }
}
