import { useCallback, useMemo, useState } from 'react'
import { adminApi } from '../../api/admin'
import { useAppSelector } from '../../app/hooks'
import { ConfirmDialog } from '../../components/admin/ConfirmDialog'
import { CrudPage } from '../../components/admin/CrudPage'
import type { Column } from '../../components/admin/DataTable'
import type { FieldDef } from '../../components/admin/EntityForm'
import { selectUser } from '../../features/auth/authSlice'
import { flag, nullable, str, text, type Values } from '../../lib/adminForm'
import { formatDateTime } from '../../lib/format'
import { ROLE_LABEL } from '../../lib/roles'
import { rules } from '../../lib/validation'
import type { AdminUser } from '../../types/admin'
import type { Role } from '../../types/auth'

const STAFF: Role[] = ['receptionist', 'doctor', 'admin']
const STAFF_OPTIONS = STAFF.map((role) => ({ value: role, label: ROLE_LABEL[role] }))
const ALL_OPTIONS = (Object.keys(ROLE_LABEL) as Role[]).map((role) => ({ value: role, label: ROLE_LABEL[role] }))

type Pending = { kind: 'toggle'; user: AdminUser } | { kind: 'reset'; user: AdminUser } | null

export default function UsersPage() {
  const me = useAppSelector(selectUser)
  const [role, setRole] = useState('')
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState<Pending>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(
    async (page: number) => {
      const response = await adminApi.users({ page, per_page: 20, role, q: search })
      return { rows: response.users, pagination: response.pagination }
    },
    [role, search],
  )

  const columns = useMemo<Column<AdminUser>[]>(
    () => [
      { key: 'full_name', header: 'Name' },
      { key: 'email', header: 'Email' },
      { key: 'role', header: 'Role', render: (user) => ROLE_LABEL[user.role] },
      { key: 'is_active', header: 'Status', render: (user) => (user.is_active ? 'Active' : 'Deactivated') },
      { key: 'last_login_at', header: 'Last sign in', render: (user) => formatDateTime(user.last_login_at) },
    ],
    [],
  )

  const fields = useCallback(
    (editing: AdminUser | null): FieldDef[] => {
      const base: FieldDef[] = [
        { name: 'full_name', label: 'Full name', required: true, minLength: 2, maxLength: 120, validators: [rules.name()] },
        { name: 'phone', label: 'Mobile number', kind: 'tel', hint: '10 digit Indian mobile number' },
      ]
      if (editing === null) {
        return [
          { name: 'email', label: 'Email address', kind: 'email', required: true },
          ...base,
          { name: 'role', label: 'Role', kind: 'select', required: true, options: STAFF_OPTIONS },
          { name: 'password', label: 'Temporary password', kind: 'password', required: true, hint: 'At least 10 characters with upper and lower case, a number and a symbol.' },
        ]
      }
      const isSelf = editing.id === me?.id
      const editable: FieldDef[] = []
      if (STAFF.includes(editing.role) && !isSelf) {
        editable.push({ name: 'role', label: 'Role', kind: 'select', required: true, options: STAFF_OPTIONS })
      }
      if (!isSelf) {
        editable.push({ name: 'is_active', label: 'Account is active', kind: 'checkbox' })
      }
      return [...base, ...editable]
    },
    [me?.id],
  )

  return (
    <>
      <CrudPage<AdminUser>
        title="Users"
        entity="user"
        description="Create staff accounts, change staff roles and deactivate accounts. Accounts are deactivated rather than deleted so history stays intact."
        columns={columns}
        fields={fields}
        deps={[reloadKey]}
        load={load}
        rowName={(user) => user.full_name}
        toForm={(user) => ({
          email: '',
          full_name: text(user?.full_name),
          phone: text(user?.phone),
          role: user?.role ?? 'receptionist',
          password: '',
          is_active: user?.is_active ?? true,
        })}
        create={(values: Values) =>
          adminApi.createUser({ email: str(values, 'email'), full_name: str(values, 'full_name'), phone: nullable(values, 'phone'), role: str(values, 'role'), password: str(values, 'password') })
        }
        update={(user, values: Values) =>
          adminApi.updateUser(user.id, {
            full_name: str(values, 'full_name'),
            phone: nullable(values, 'phone'),
            ...(STAFF.includes(user.role) && user.id !== me?.id ? { role: str(values, 'role') } : {}),
            ...(user.id !== me?.id ? { is_active: flag(values, 'is_active') } : {}),
          })
        }
        toolbar={
          <div className="filters">
            <label>
              <span className="filters__label">Role</span>
              <select value={role} onChange={(event) => setRole(event.target.value)} className="field__input">
                <option value="">All roles</option>
                {ALL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="filters__label">Search</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="field__input" placeholder="Name or email" maxLength={80} />
            </label>
          </div>
        }
        extraActions={(user) => (
          <>
            {user.id !== me?.id ? (
              <button type="button" className="btn btn--outline btn--sm" onClick={() => setPending({ kind: 'toggle', user })} aria-label={`${user.is_active ? 'Deactivate' : 'Activate'} ${user.full_name}`}>
                {user.is_active ? 'Deactivate' : 'Activate'}
              </button>
            ) : null}
            {user.is_active ? (
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => {
                  setNotice(null)
                  setPending({ kind: 'reset', user })
                }}
                aria-label={`Send password reset to ${user.full_name}`}
              >
                Reset password
              </button>
            ) : null}
          </>
        )}
      />
      {notice !== null ? (
        <p className="alert alert--success" role="status">
          {notice}
        </p>
      ) : null}
      {pending?.kind === 'toggle' ? (
        <ConfirmDialog
          title={pending.user.is_active ? 'Deactivate account' : 'Activate account'}
          confirmLabel={pending.user.is_active ? 'Deactivate' : 'Activate'}
          tone={pending.user.is_active ? 'danger' : 'primary'}
          onCancel={() => setPending(null)}
          onConfirm={async () => {
            await adminApi.updateUser(pending.user.id, { is_active: !pending.user.is_active })
            setPending(null)
            setReloadKey((key) => key + 1)
          }}
        >
          <p>
            {pending.user.is_active ? 'Deactivate' : 'Activate'} <strong>{pending.user.full_name}</strong>?{' '}
            {pending.user.is_active ? 'They will be signed out and will not be able to sign in.' : 'They will be able to sign in again.'}
          </p>
        </ConfirmDialog>
      ) : null}
      {pending?.kind === 'reset' ? (
        <ConfirmDialog
          title="Send password reset"
          confirmLabel="Send reset link"
          onCancel={() => setPending(null)}
          onConfirm={async () => {
            await adminApi.sendPasswordReset(pending.user.id)
            setPending(null)
            setNotice(`A password reset link was emailed to ${pending.user.email}.`)
          }}
        >
          <p>
            Email a one-time password reset link to <strong>{pending.user.email}</strong>?
          </p>
        </ConfirmDialog>
      ) : null}
    </>
  )
}
