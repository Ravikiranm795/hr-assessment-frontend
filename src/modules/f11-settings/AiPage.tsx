import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { api } from '@/core/api/client'
import { ApiError, errorText } from '@/core/api/errors'
import { useAuth } from '@/core/auth/AuthProvider'
import { formatDateTime, formatNumber } from '@/core/utils'
import { Card, Select, SettingsFrame, useSaveSetting, useSetting } from './common'

interface Provider {
  id: string
  label: string
  modes: ('api' | 'cli')[]
  requires_api_key?: boolean
  requires_base_url?: boolean
  requires_model?: boolean
  default_model?: string | null
  models?: string[]
}
interface AiSettings {
  configured: boolean
  provider: string | null
  model: string | null
  mode: 'api' | 'cli' | null
  base_url: string | null
  api_key_set: boolean
  api_key_masked: string | null
  cli_command_key: string | null
  monthly_call_cap: number | null
  verified_at: string | null
}
interface Usage {
  month: string
  calls: number
  tokens_in: number
  tokens_out: number
  monthly_call_cap: number | null
  remaining: number | null
}

const PATH = '/api/v1/org/settings/ai'

export function AiPage() {
  const { t } = useTranslation()
  const { me } = useAuth()
  const providers = useQuery({ queryKey: ['settings', 'ai-providers'], queryFn: () => api.get<{ providers: Provider[] }>(`${PATH}/providers`) })
  const query = useSetting<AiSettings>(PATH)
  const usage = useQuery({ queryKey: ['settings', 'ai-usage'], queryFn: () => api.get<Usage>('/api/v1/org/ai-usage') })
  const save = useSaveSetting<unknown>(PATH, 'put')

  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [mode, setMode] = useState<'api' | 'cli'>('api')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [cli, setCli] = useState('')
  const [cap, setCap] = useState('')
  const [banner, setBanner] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)

  const s = query.data
  // Load the saved values into the form once they arrive. The API key is write-only and never pre-filled.
  useEffect(() => {
    if (!s) return
    setProvider(s.provider ?? '')
    setModel(s.model ?? '')
    setMode(s.mode ?? 'api')
    setBaseUrl(s.base_url ?? '')
    setCli(s.cli_command_key ?? '')
    setCap(s.monthly_call_cap ? String(s.monthly_call_cap) : '')
    setApiKey('')
  }, [s])

  const current = providers.data?.providers.find((p) => p.id === provider)
  const pickProvider = (id: string) => {
    const p = providers.data?.providers.find((x) => x.id === id)
    setProvider(id)
    setMode(p?.modes[0] ?? 'api')
    setModel(p?.default_model ?? '') // light default preselected (spec F11)
  }

  const test = useMutation({
    mutationFn: () => api.post<{ ok: boolean; reason?: string | null }>(`${PATH}/test`),
    onSuccess: (r) => setTestResult(r.ok ? { ok: true, text: t('settings.ai.testOk') } : { ok: false, text: t('settings.ai.testFail', { reason: r.reason ?? '' }) }),
    onError: (e) => setTestResult({ ok: false, text: errorText(e) }),
  })

  const submit = () => {
    setBanner(null)
    save.mutate(
      {
        provider,
        model: model.trim() || null,
        mode,
        base_url: current?.requires_base_url ? baseUrl.trim() || null : null,
        ...(apiKey ? { api_key: apiKey } : {}),
        cli_command_key: mode === 'cli' ? cli.trim() || null : null,
        monthly_call_cap: cap.trim() ? Number(cap) : null,
      },
      { onError: (e) => setBanner(e instanceof ApiError && e.fieldErrors[0] ? `${e.fieldErrors[0].field}: ${errorText(e)}` : errorText(e)) },
    )
  }

  const u = usage.data
  const pct = u?.monthly_call_cap ? Math.min(100, Math.round((u.calls / u.monthly_call_cap) * 100)) : 0

  return (
    <SettingsFrame title={t('settings.ai.title')} subtitle={t('settings.ai.subtitle')} query={query}>
      {u && (
        <Card title={t('settings.ai.usage')}>
          <p className="text-sm">{u.monthly_call_cap ? t('settings.ai.usageOf', { calls: formatNumber(u.calls), cap: formatNumber(u.monthly_call_cap) }) : t('settings.ai.usageCalls', { calls: formatNumber(u.calls) })}</p>
          {u.monthly_call_cap ? (
            <div className="h-2 overflow-hidden rounded-full bg-bg" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          ) : null}
          <p className="text-xs text-muted">{t('settings.ai.usageTokens', { in: formatNumber(u.tokens_in), out: formatNumber(u.tokens_out) })}</p>
        </Card>
      )}

      <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); submit() }}>
        {banner && <p role="alert" className="text-sm text-error">{banner}</p>}
        <Card>
          <Select id="ai-provider" label={t('settings.ai.provider')} value={provider} onChange={pickProvider}>
            <option value="" disabled>{t('settings.ai.select')}</option>
            {providers.data?.providers.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </Select>

          {current && current.modes.length > 1 && (
            <Select id="ai-mode" label={t('settings.ai.mode')} value={mode} onChange={(v) => setMode(v as 'api' | 'cli')}>
              {current.modes.map((m) => (
                <option key={m} value={m}>{t(`settings.ai.mode_${m}`)}</option>
              ))}
            </Select>
          )}

          {current?.requires_model && ((current.models?.length ?? 0) > 0 ? (
            <Select id="ai-model" label={t('settings.ai.model')} value={model} onChange={setModel}>
              {current.models!.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          ) : (
            <Field label={t('settings.ai.model')} value={model} onChange={(e) => setModel(e.target.value)} />
          ))}

          {current?.requires_base_url && <Field label={t('settings.ai.baseUrl')} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />}

          {current?.requires_api_key !== false && mode === 'api' && current && (
            <Field
              label={t('settings.ai.apiKey')}
              type="password"
              autoComplete="new-password"
              placeholder={s?.api_key_set ? (s.api_key_masked ?? '••••••••') : undefined}
              hint={s?.api_key_set ? t('settings.writeOnly.set') : t('settings.writeOnly.unset')}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          )}

          {mode === 'cli' && <Field label={t('settings.ai.cliCommand')} value={cli} onChange={(e) => setCli(e.target.value)} />}

          <Field label={t('settings.ai.cap')} hint={t('settings.ai.capHint')} type="number" min={1} value={cap} onChange={(e) => setCap(e.target.value)} />
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={save.isPending} disabled={!provider}>
            {t('settings.save')}
          </Button>
          <Button variant="outline" loading={test.isPending} disabled={!s?.configured} onClick={() => { setTestResult(null); test.mutate() }}>
            {t('settings.ai.test')}
          </Button>
          {s?.verified_at && <Badge tone="success">{t('settings.ai.verified', { when: formatDateTime(s.verified_at, me?.organization?.timezone) })}</Badge>}
        </div>
        {testResult && <p role="status" className={testResult.ok ? 'text-sm text-success' : 'text-sm text-error'}>{testResult.text}</p>}
      </form>
    </SettingsFrame>
  )
}
