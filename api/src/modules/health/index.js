import { get } from '../../core/router.js'
import { ok } from '../../core/response.js'

export const show = () => ok({ status: 'ok', service: 'diagnocare-api' })

export const routes = [get('/health', show)]
