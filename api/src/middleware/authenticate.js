export const authenticate = ({ services }) => async (req, next) => {
  req.user = await services.auth.resolveUser(req)
  return next(req)
}
