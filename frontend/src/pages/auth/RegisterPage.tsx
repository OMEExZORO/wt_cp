import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAppDispatch } from '../../app/hooks'
import { CheckboxField } from '../../components/form/CheckboxField'
import { FormAlert } from '../../components/form/FormAlert'
import { RadioGroup } from '../../components/form/RadioGroup'
import { SelectField } from '../../components/form/SelectField'
import { SubmitButton } from '../../components/form/SubmitButton'
import { TextField } from '../../components/form/TextField'
import { register } from '../../features/auth/authSlice'
import { useForm } from '../../hooks/useForm'
import { compose, fieldRules, normalisePhone, rules } from '../../lib/validation'
import type { AccountType, Gender, RegisterRequest } from '../../types/auth'

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

const commonValidators = {
  full_name: fieldRules.fullName,
  email: fieldRules.email,
  phone: fieldRules.phone,
  password: fieldRules.newPassword,
  password_confirmation: compose(rules.required(), rules.matches('password')),
  consent: rules.accepted('Please give your consent to continue.'),
}

const patientValidators = {
  ...commonValidators,
  date_of_birth: rules.pastDate(),
  gender: rules.oneOf(GENDERS.map((g) => g.value)),
  city: fieldRules.city,
}

const referrerValidators = {
  ...commonValidators,
  qualification: compose(rules.required(), rules.safe(), rules.minLength(2), rules.maxLength(120)),
  registration_number: compose(rules.required(), rules.safe(), rules.registrationNumber()),
  clinic_name: compose(rules.required(), rules.safe(), rules.minLength(2), rules.maxLength(160)),
  city: compose(rules.required(), fieldRules.city),
}

const initialValues = {
  full_name: '',
  email: '',
  phone: '',
  password: '',
  password_confirmation: '',
  date_of_birth: '',
  gender: '',
  city: '',
  qualification: '',
  registration_number: '',
  clinic_name: '',
  consent: false,
}

export default function RegisterPage() {
  const dispatch = useAppDispatch()
  const [accountType, setAccountType] = useState<AccountType>('patient')
  const form = useForm({ initialValues, validators: accountType === 'patient' ? patientValidators : referrerValidators })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    form.touchAll()
    if (!form.isValid) {
      return
    }
    const v = form.trimmedValues()
    const base = {
      full_name: String(v.full_name),
      email: String(v.email).toLowerCase(),
      phone: normalisePhone(String(v.phone)),
      password: String(v.password),
      password_confirmation: String(v.password_confirmation),
      consent: v.consent === true,
    }
    const payload: RegisterRequest =
      accountType === 'patient'
        ? {
            ...base,
            account_type: 'patient',
            date_of_birth: String(v.date_of_birth) || undefined,
            gender: (String(v.gender) as Gender | '') || undefined,
            city: String(v.city) || undefined,
          }
        : {
            ...base,
            account_type: 'referrer',
            qualification: String(v.qualification),
            registration_number: String(v.registration_number),
            clinic_name: String(v.clinic_name),
            city: String(v.city),
          }
    setSubmitting(true)
    setFormError(null)
    const result = await dispatch(register(payload))
    if (register.rejected.match(result)) {
      setFormError(result.payload?.message ?? 'Registration failed. Please try again.')
      form.setServerErrors(result.payload?.fields ?? {})
      setSubmitting(false)
    }
  }

  return (
    <section className="container auth-card auth-card--wide" aria-labelledby="register-title">
      <h1 id="register-title">Create your account</h1>
      {formError !== null ? <FormAlert>{formError}</FormAlert> : null}
      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
        <RadioGroup
          legend="I am registering as"
          name="account_type"
          value={accountType}
          onChange={(event) => setAccountType(event.target.value as AccountType)}
          options={[
            { value: 'patient', label: 'Patient', description: 'Book scans and download your reports' },
            { value: 'referrer', label: 'Referring doctor', description: 'Refer patients and view their reports' },
          ]}
        />
        <TextField label="Full name" autoComplete="name" required {...form.field('full_name')} />
        <TextField label="Email address" type="email" autoComplete="email" required {...form.field('email')} />
        <TextField label="Mobile number" type="tel" autoComplete="tel" inputMode="tel" hint="10 digit Indian mobile number, optional +91" required {...form.field('phone')} />
        {accountType === 'patient' ? (
          <>
            <TextField label="Date of birth" type="date" {...form.field('date_of_birth')} />
            <SelectField label="Gender" placeholder="Select (optional)" options={GENDERS} {...form.field('gender')} />
            <TextField label="City" autoComplete="address-level2" {...form.field('city')} />
          </>
        ) : (
          <>
            <TextField label="Qualification" hint="For example MBBS, MD" required {...form.field('qualification')} />
            <TextField label="Medical council registration number" required {...form.field('registration_number')} />
            <TextField label="Clinic or hospital name" required {...form.field('clinic_name')} />
            <TextField label="City" autoComplete="address-level2" required {...form.field('city')} />
          </>
        )}
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters with upper and lower case letters, a number and a symbol"
          required
          {...form.field('password')}
        />
        <TextField label="Confirm password" type="password" autoComplete="new-password" required {...form.field('password_confirmation')} />
        <CheckboxField required {...form.checkbox('consent')}>
          I consent to Meghnad Diagnostic Centre collecting and using my personal and health information to provide diagnostic services,
          as described in the privacy notice, in line with the Digital Personal Data Protection Act, 2023. I can withdraw consent by contacting
          the centre.
        </CheckboxField>
        <SubmitButton disabled={!form.isValid} loading={submitting} loadingText="Creating account…">
          Create account
        </SubmitButton>
      </form>
      <p className="auth-card__links">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </section>
  )
}
