import { Model } from './model.js'

export class SiteSetting extends Model {
  static table = 'site_settings'
  static primaryKey = 'key'
  static fillable = ['value', 'is_placeholder', 'updated_by_user_id']

  publicRows() {
    return this.db.all(
      'SELECT key, value, value_type, group_name, label, is_placeholder FROM site_settings WHERE is_public = TRUE ORDER BY group_name, key',
    )
  }
}
