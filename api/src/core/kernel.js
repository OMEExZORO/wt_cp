import { compose } from './pipeline.js'

export class Kernel {
  constructor({ app, errors, globalMiddleware, resolveRouteMiddleware, router }) {
    this.app = app
    this.errors = errors
    this.router = router
    this.resolveRouteMiddleware = resolveRouteMiddleware
    this.routeChains = new Map()
    this.pipeline = compose(globalMiddleware, (req) => this.chainFor(req.route)(req))
  }

  warm() {
    for (const route of this.router.routes) this.chainFor(route)
  }

  chainFor(route) {
    let chain = this.routeChains.get(route)
    if (!chain) {
      const middleware = route.middleware.map((spec) => this.resolveRouteMiddleware(spec))
      chain = compose(middleware, (req) => route.handler(req, this.app))
      this.routeChains.set(route, chain)
    }
    return chain
  }

  async handle(req) {
    let response
    try {
      response = await this.pipeline(req)
    } catch (error) {
      response = this.errors.render(error)
    }
    for (const line of req.responseCookies) response.addCookie(line)
    return response
  }
}
