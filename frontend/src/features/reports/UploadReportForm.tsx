import { useState, type ChangeEvent, type FormEvent } from 'react'
import { reportsApi } from '../../api/reports'
import { FormAlert } from '../../components/form/FormAlert'
import { SelectField } from '../../components/form/SelectField'
import { SubmitButton } from '../../components/form/SubmitButton'
import { TextAreaField } from '../../components/form/TextAreaField'
import { TextField } from '../../components/form/TextField'
import { ApiError } from '../../api/client'
import { useForm } from '../../hooks/useForm'
import { compose, rules, type FieldValidator } from '../../lib/validation'
import { MAX_REPORT_BYTES, REPORT_ACCEPT, formatBytes, validateReportFile } from '../../lib/reportFile'
import type { ReportDetail, StaffAppointmentOption } from '../../types/report'

export interface UploadReportFormProps {
  appointments: StaffAppointmentOption[]
  initialAppointmentId?: string
  onUploaded?: (report: ReportDetail) => void
}

const initialValues = { appointment_id: '', title: '', notes: '', impression: '', status: 'final' }

const validators: Record<keyof typeof initialValues, FieldValidator> = {
  appointment_id: rules.required('Choose the appointment this report belongs to.'),
  title: compose(rules.required('Enter a report title.'), rules.safe(), rules.minLength(2), rules.maxLength(200)),
  notes: compose(rules.safe(), rules.maxLength(5000)),
  impression: compose(rules.safe(), rules.maxLength(5000)),
  status: compose(rules.required(), rules.oneOf(['draft', 'final'])),
}

export function appointmentLabel(appointment: StaffAppointmentOption): string {
  return `${appointment.reference_code} · ${appointment.patient.full_name} · ${appointment.scan_type.name} · ${appointment.slot.date}`
}

export function UploadReportForm({ appointments, initialAppointmentId = '', onUploaded }: UploadReportFormProps) {
  const form = useForm({ initialValues: { ...initialValues, appointment_id: initialAppointmentId }, validators })
  const [file, setFile] = useState<File | null>(null)
  const [fileTouched, setFileTouched] = useState(false)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<ReportDetail | null>(null)

  const fileError = validateReportFile(file)
  const visibleFileError = fileTouched ? (form.errors.file ?? fileError ?? undefined) : form.errors.file
  const canSubmit = form.isValid && fileError === null

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null)
    setFileTouched(true)
    setDone(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    form.touchAll()
    setFileTouched(true)
    if (!canSubmit || file === null) {
      return
    }
    const values = form.trimmedValues()
    setUploading(true)
    setError(null)
    setDone(null)
    try {
      const { report } = await reportsApi.upload({
        appointment_id: values.appointment_id,
        title: values.title,
        notes: values.notes,
        impression: values.impression,
        status: values.status === 'draft' ? 'draft' : 'final',
        file,
      })
      setDone(report)
      onUploaded?.(report)
      form.reset({ ...initialValues, appointment_id: values.appointment_id })
      setFile(null)
      setFileTouched(false)
      setFileInputKey((key) => key + 1)
    } catch (cause) {
      if (cause instanceof ApiError) {
        form.setServerErrors(cause.fields)
        setError(cause.message)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setUploading(false)
    }
  }

  const options = appointments.map((appointment) => ({ value: appointment.id, label: appointmentLabel(appointment) }))

  return (
    <form className="stack" onSubmit={(event) => void handleSubmit(event)} noValidate aria-label="Upload report">
      {error !== null ? <FormAlert>{error}</FormAlert> : null}
      {done !== null ? <FormAlert tone="success">Report “{done.title}” was uploaded and encrypted.</FormAlert> : null}

      <SelectField
        label="Appointment"
        required
        placeholder="Choose an appointment"
        options={options}
        {...form.field('appointment_id')}
      />
      <TextField label="Report title" required maxLength={200} autoComplete="off" {...form.field('title')} />

      <div className={`field${visibleFileError !== undefined ? ' field--invalid' : ''}`}>
        <label htmlFor="report-file" className="field__label">
          Report file <span aria-hidden="true">*</span>
        </label>
        <input
          key={fileInputKey}
          id="report-file"
          name="file"
          type="file"
          accept={REPORT_ACCEPT}
          className="field__input"
          onChange={handleFile}
          aria-invalid={visibleFileError !== undefined}
          aria-describedby="report-file-hint report-file-error"
          disabled={uploading}
        />
        <p id="report-file-hint" className="field__hint">
          PDF, JPG or PNG, up to {formatBytes(MAX_REPORT_BYTES)}.{file !== null ? ` Selected: ${file.name} (${formatBytes(file.size)}).` : ''}
        </p>
        {visibleFileError !== undefined ? (
          <p id="report-file-error" className="field__error" role="alert">
            {visibleFileError}
          </p>
        ) : null}
      </div>

      <TextAreaField label="Clinical notes (encrypted)" rows={3} maxLength={5000} {...form.field('notes')} />
      <TextAreaField label="Impression (encrypted)" rows={3} maxLength={5000} {...form.field('impression')} />
      <SelectField
        label="Status"
        options={[
          { value: 'final', label: 'Final (visible to the patient and referrer)' },
          { value: 'draft', label: 'Draft (staff only)' },
        ]}
        {...form.field('status')}
      />

      {uploading ? (
        <div role="progressbar" aria-label="Uploading report" aria-busy="true" className="page-loader__spinner" />
      ) : null}
      <SubmitButton disabled={!canSubmit} loading={uploading} loadingText="Encrypting and uploading…">
        Upload report
      </SubmitButton>
    </form>
  )
}
