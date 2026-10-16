export const handleErrors = ({ errors }) => async (req, next) => {
  try {
    return await next(req)
  } catch (error) {
    return errors.render(error)
  }
}
