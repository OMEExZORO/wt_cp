import { Csrf } from '../core/csrf.js'
import { Session } from '../core/session.js'

export const startSession = ({ config, cookies, sessionStore }) => async (req, next) => {
  const session = new Session({ store: sessionStore, config, cookies, req })
  req.session = session
  req.csrf = new Csrf(session, config.csrfSecret)
  await session.start()
  req.sessionExpired = session.wasExpired()
  try {
    return await next(req)
  } finally {
    await session.commit()
  }
}
