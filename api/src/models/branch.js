import { Model } from './model.js'

export class Branch extends Model {
  static table = 'branches'
  static fillable = [
    'slug', 'name', 'address_line', 'landmark', 'area', 'city', 'state', 'postal_code', 'phone', 'phone_secondary', 'whatsapp',
    'email', 'opening_hours', 'maps_url', 'maps_embed_url', 'latitude', 'longitude', 'is_placeholder', 'is_active', 'sort_order',
  ]

  listActive() {
    return this.db.all('SELECT * FROM branches WHERE is_active = TRUE ORDER BY sort_order, name')
  }

  findActive(id) {
    return this.db.one('SELECT * FROM branches WHERE id = $1 AND is_active = TRUE', [id])
  }
}
