import { EncryptionService } from '../encryption.js'
import { createStorage } from '../storage/index.js'
import { Referral } from '../../models/referral.js'
import { Report } from '../../models/report.js'
import { ReportAccessLog } from '../../models/report-access-log.js'
import { ReportPresenter } from './report-presenter.js'
import { ReportService } from './report-service.js'
import { UploadedFileValidator } from './uploaded-file-validator.js'

export const registerReportModels = (app) => {
  const options = { timezone: app.config.timezone }
  app.models.reports ??= new Report(app.db, options)
  app.models.referrals ??= new Referral(app.db, options)
  app.models.reportAccessLog ??= new ReportAccessLog(app.db, options)
}

export const encryptionOf = (app) => {
  app.services.encryption ??= EncryptionService.fromEnv()
  return app.services.encryption
}

export const reportServices = (app) => {
  const services = app.services
  const crypto = encryptionOf(app)
  services.storage ??= createStorage(app.config)
  services.reportFiles ??= new UploadedFileValidator()
  services.reportPresenter ??= new ReportPresenter({ crypto, timezone: app.config.timezone })
  services.reportService ??= new ReportService({
    db: app.db,
    reports: app.models.reports,
    referrals: app.models.referrals,
    accessLog: app.models.reportAccessLog,
    storage: services.storage,
    crypto,
    timezone: app.config.timezone,
  })
  return services
}
