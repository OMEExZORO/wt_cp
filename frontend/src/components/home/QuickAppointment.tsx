import { useEffect, useMemo, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '../../app/hooks'
import { useForm } from '../../hooks/useForm'
import { MODALITY_OPTIONS, buildBookQuery } from '../../lib/prefill'
import { compose, fieldRules, normalisePhone, rules } from '../../lib/validation'
import { SelectField } from '../form/SelectField'
import { TextField } from '../form/TextField'
import { CalendarIcon } from '../icons/Icons'

const validators = {
  branch: compose(rules.required('Choose a centre.')),
  name: fieldRules.fullName,
  phone: fieldRules.phone,
  modality: compose(rules.required('Choose a scan type.')),
}

export function QuickAppointment() {
  const navigate = useNavigate()
  const branches = useAppSelector((state) => state.public.branches.data?.branches ?? [])
  const centres = useMemo(() => branches.filter((branch) => !branch.address_is_placeholder), [branches])
  const form = useForm({ initialValues: { branch: '', name: '', phone: '', modality: '' }, validators })
  const { setValue } = form
  const onlyCentre = centres.length === 1 ? centres[0].slug : null

  useEffect(() => {
    if (onlyCentre !== null) {
      setValue('branch', onlyCentre)
    }
  }, [onlyCentre, setValue])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    form.touchAll()
    if (!form.isValid) {
      return
    }
    const values = form.trimmedValues()
    const query = buildBookQuery({
      branch: String(values.branch),
      name: String(values.name),
      phone: normalisePhone(String(values.phone)),
      modality: String(values.modality),
    })
    navigate(`/book?${query}`)
  }

  return (
    <form className="quick-card" onSubmit={onSubmit} noValidate aria-labelledby="quick-title">
      <h2 id="quick-title" className="quick-card__title">
        Request an appointment
      </h2>
      <p className="quick-card__lead">Tell us a little and we will take you to booking with these details filled in.</p>
      <SelectField
        label="Centre"
        required
        placeholder="Select a centre"
        options={centres.map((branch) => ({ value: branch.slug, label: branch.name }))}
        {...form.field('branch')}
      />
      <TextField label="Full name" autoComplete="name" required {...form.field('name')} />
      <TextField label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" required {...form.field('phone')} />
      <SelectField label="Scan type" required placeholder="Select a scan type" options={MODALITY_OPTIONS} {...form.field('modality')} />
      <button type="submit" className="btn btn--primary btn--lg quick-card__submit">
        <CalendarIcon size={20} /> Continue to booking
      </button>
      <p className="quick-card__note">Not for emergencies. In an emergency, call 112.</p>
    </form>
  )
}
