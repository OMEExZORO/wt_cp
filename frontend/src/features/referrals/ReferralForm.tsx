import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { referralsApi } from '../../api/referrals'
import { FormAlert } from '../../components/form/FormAlert'
import { SelectField } from '../../components/form/SelectField'
import { SubmitButton } from '../../components/form/SubmitButton'
import { TextAreaField } from '../../components/form/TextAreaField'
import { TextField } from '../../components/form/TextField'
import { useForm } from '../../hooks/useForm'
import { compose, fieldRules, rules, type FieldValidator } from '../../lib/validation'
import type { Referral, ReferralUrgency } from '../../types/referral'

export interface ScanOption {
  value: string
  label: string
}

export interface ReferralFormProps {
  scanOptions: ScanOption[]
  onCreated?: (referral: Referral) => void
}

const initialValues = {
  patient_name: '',
  patient_phone: '',
  patient_email: '',
  scan_type_id: '',
  urgency: 'Routine',
  clinical_notes: '',
}

const URGENCIES: ReferralUrgency[] = ['Routine', 'Priority', 'Urgent']

const validators: Record<keyof typeof initialValues, FieldValidator> = {
  patient_name: fieldRules.fullName,
  patient_phone: fieldRules.phone,
  patient_email: compose(rules.safe(), rules.maxLength(254), rules.email()),
  scan_type_id: rules.required('Choose the scan you are requesting.'),
  urgency: compose(rules.required(), rules.oneOf(URGENCIES)),
  clinical_notes: compose(rules.safe(), rules.maxLength(2000)),
}

export function ReferralForm({ scanOptions, onCreated }: ReferralFormProps) {
  const form = useForm({ initialValues, validators })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Referral | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    form.touchAll()
    if (!form.isValid) {
      return
    }
    const values = form.trimmedValues()
    setSubmitting(true)
    setError(null)
    setCreated(null)
    try {
      const { referral } = await referralsApi.create({
        patient_name: values.patient_name,
        patient_phone: values.patient_phone,
        ...(values.patient_email !== '' ? { patient_email: values.patient_email } : {}),
        scan_type_id: values.scan_type_id,
        urgency: URGENCIES.includes(values.urgency as ReferralUrgency) ? (values.urgency as ReferralUrgency) : 'Routine',
        ...(values.clinical_notes !== '' ? { clinical_notes: values.clinical_notes } : {}),
      })
      setCreated(referral)
      onCreated?.(referral)
      form.reset(initialValues)
    } catch (cause) {
      if (cause instanceof ApiError) {
        form.setServerErrors(cause.fields)
        setError(cause.message)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="stack" onSubmit={(event) => void handleSubmit(event)} noValidate aria-label="Create referral">
      {error !== null ? <FormAlert>{error}</FormAlert> : null}
      {created !== null ? (
        <FormAlert tone="success">
          Referral {created.reference_code} was sent to the centre. Track it in the list below.
        </FormAlert>
      ) : null}
      <TextField label="Patient name" required autoComplete="off" maxLength={120} {...form.field('patient_name')} />
      <TextField label="Patient mobile number" required type="tel" autoComplete="off" inputMode="numeric" {...form.field('patient_phone')} />
      <TextField label="Patient email (optional)" type="email" autoComplete="off" maxLength={254} {...form.field('patient_email')} />
      <SelectField
        label="Scan requested"
        required
        placeholder="Choose a scan"
        options={scanOptions}
        {...form.field('scan_type_id')}
      />
      <SelectField label="Urgency" options={URGENCIES.map((value) => ({ value, label: value }))} {...form.field('urgency')} />
      <TextAreaField
        label="Clinical notes (encrypted)"
        hint="Relevant history and the clinical question. Do not enter anything about fetal sex."
        rows={4}
        maxLength={2000}
        {...form.field('clinical_notes')}
      />
      <SubmitButton disabled={!form.isValid} loading={submitting} loadingText="Sending referral…">
        Send referral
      </SubmitButton>
    </form>
  )
}
