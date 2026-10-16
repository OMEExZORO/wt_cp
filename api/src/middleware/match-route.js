export const matchRoute = ({ router }) => async (req, next) => {
  const { route, params } = router.match(req.method, req.path)
  req.route = route
  req.routeParams = params
  return next(req)
}
