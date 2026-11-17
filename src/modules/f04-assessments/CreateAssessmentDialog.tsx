import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { errorText } from '@/core/api/errors'
import { applyFieldErrors } from '@/core/forms'
import { assessmentsApi, keys } from './api'
import { TextareaField } from './ui/controls'
import { Dialog } from './ui/Dialog'

const schema = z.object({ title: z.string().trim().min(1), description: z.string().trim() })
type Values = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Create step: title and description, then straight into the builder (version 1 is a draft). */
export function CreateAssessmentDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [banner, setBanner] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { title: '', description: '' } })

  async function onSubmit(values: Values) {
    setBanner(null)
    try {
      const created = await assessmentsApi.create({
        title: values.title,
        description: values.description || null,
      })
      await queryClient.invalidateQueries({ queryKey: keys.all })
      reset()
      onOpenChange(false)
      navigate(`/assessments/${created.id}`)
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setBanner(errorText(error))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('assessments.create.title')}
      description={t('assessments.create.body')}
    >
      <form id="create-assessment-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {banner && (
          <p role="alert" className="rounded-(--radius) border border-error/30 bg-error/5 p-3 text-sm text-error">
            {banner}
          </p>
        )}
        <Field
          label={t('assessments.field.title')}
          autoFocus
          error={errors.title && (errors.title.message && errors.title.type === 'server' ? errors.title.message : t('fieldErrors.required'))}
          {...register('title')}
        />
        <TextareaField label={t('assessments.field.description')} error={errors.description?.message} {...register('description')} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {t('assessments.create.submit')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
