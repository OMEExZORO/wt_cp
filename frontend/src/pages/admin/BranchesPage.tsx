import { useCallback, useMemo } from 'react'
import { adminApi } from '../../api/admin'
import { CrudPage } from '../../components/admin/CrudPage'
import type { Column } from '../../components/admin/DataTable'
import type { FieldDef } from '../../components/admin/EntityForm'
import { adminRules } from '../../lib/adminValidation'
import { flag, int, nullable, str, text, type Values } from '../../lib/adminForm'
import type { AdminBranch } from '../../types/admin'

const FIELDS: FieldDef[] = [
  { name: 'name', label: 'Branch name', required: true, minLength: 2, maxLength: 120 },
  { name: 'slug', label: 'Short name for links', required: true, maxLength: 60, hint: 'Lowercase letters, digits and hyphens, for example bhosari.', validators: [adminRules.slug()] },
  { name: 'address_line', label: 'Address', required: true, minLength: 3 },
  { name: 'landmark', label: 'Landmark' },
  { name: 'area', label: 'Area' },
  { name: 'city', label: 'City', required: true, minLength: 2, maxLength: 80 },
  { name: 'state', label: 'State', required: true, minLength: 2, maxLength: 80 },
  { name: 'postal_code', label: 'PIN code', validators: [adminRules.postalCode()] },
  { name: 'phone', label: 'Phone number', kind: 'tel', hint: '10 digit Indian mobile number' },
  { name: 'whatsapp', label: 'WhatsApp number', kind: 'tel' },
  { name: 'email', label: 'Email address', kind: 'email' },
  { name: 'opening_hours', label: 'Opening hours', kind: 'textarea', rows: 3, maxLength: 500 },
  { name: 'maps_url', label: 'Google Maps link', kind: 'url', maxLength: 500, hint: 'Must start with https://' },
  { name: 'maps_embed_url', label: 'Google Maps embed link', kind: 'url', maxLength: 800 },
  { name: 'latitude', label: 'Latitude', validators: [adminRules.latitude()] },
  { name: 'longitude', label: 'Longitude', validators: [adminRules.longitude()] },
  { name: 'sort_order', label: 'Display order', kind: 'number', min: 0, max: 1000 },
  { name: 'is_active', label: 'Shown on the website and open for booking', kind: 'checkbox' },
]

export function branchPayload(values: Values) {
  return {
    slug: str(values, 'slug'),
    name: str(values, 'name'),
    address_line: str(values, 'address_line'),
    landmark: nullable(values, 'landmark'),
    area: nullable(values, 'area'),
    city: str(values, 'city'),
    state: str(values, 'state'),
    postal_code: nullable(values, 'postal_code'),
    phone: nullable(values, 'phone'),
    whatsapp: nullable(values, 'whatsapp'),
    email: nullable(values, 'email'),
    opening_hours: nullable(values, 'opening_hours'),
    maps_url: nullable(values, 'maps_url'),
    maps_embed_url: nullable(values, 'maps_embed_url'),
    latitude: nullable(values, 'latitude'),
    longitude: nullable(values, 'longitude'),
    sort_order: int(values, 'sort_order'),
    is_active: flag(values, 'is_active'),
  }
}

export default function BranchesPage() {
  const load = useCallback(async () => ({ rows: (await adminApi.branches()).branches }), [])
  const columns = useMemo<Column<AdminBranch>[]>(
    () => [
      { key: 'name', header: 'Branch' },
      {
        key: 'address_line',
        header: 'Address',
        render: (branch) => (
          <>
            {branch.address_line}
            {branch.is_placeholder ? <span className="badge badge--todo"> Needs real address</span> : null}
          </>
        ),
      },
      { key: 'phone', header: 'Phone' },
      { key: 'is_active', header: 'Status', render: (branch) => (branch.is_active ? 'Active' : 'Hidden') },
    ],
    [],
  )

  return (
    <CrudPage<AdminBranch>
      title="Branches"
      entity="branch"
      description="Branch details appear on the website and in booking. Branches with bookings cannot be deleted; hide them instead."
      columns={columns}
      fields={FIELDS}
      load={load}
      rowName={(branch) => branch.name}
      toForm={(branch) => ({
        name: text(branch?.name),
        slug: text(branch?.slug),
        address_line: text(branch?.address_line),
        landmark: text(branch?.landmark),
        area: text(branch?.area),
        city: branch?.city ?? 'Pune',
        state: branch?.state ?? 'Maharashtra',
        postal_code: text(branch?.postal_code),
        phone: text(branch?.phone),
        whatsapp: text(branch?.whatsapp),
        email: text(branch?.email),
        opening_hours: text(branch?.opening_hours),
        maps_url: text(branch?.maps_url),
        maps_embed_url: text(branch?.maps_embed_url),
        latitude: text(branch?.latitude),
        longitude: text(branch?.longitude),
        sort_order: text(branch?.sort_order ?? 0),
        is_active: branch?.is_active ?? true,
      })}
      create={(values) => adminApi.createBranch(branchPayload(values))}
      update={(branch, values) => adminApi.updateBranch(branch.id, branchPayload(values))}
      remove={(branch) => adminApi.deleteBranch(branch.id)}
    />
  )
}
