'use client'

import {
  COMPARISON_RULES,
  MDX_COMPONENTS,
  QUESTION_LIMITS,
  type ComparisonRule,
  type MdxPreviewResult,
  type QuestionDetail,
} from '@bot-arena/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eye, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormError, SelectField, TextareaField, TextField } from '@/components/form-parts'
import { MdxContent } from '@/components/mdx-content'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { createApiClient, readApiError } from '@/lib/api'
import { useErrorMessage } from '@/lib/use-error-message'
import { ensureOk, fetchQuestion, QUESTIONS_KEY, questionKey, studentViewKey } from './api'
import { useDifficultyOptions } from './difficulty-badge'
import { TestCasesEditor } from './test-cases-editor'

/** The MDX components a statement may use, as the hint text lists them: `<Note title="…">`. */
const MDX_COMPONENT_LIST = Object.entries(MDX_COMPONENTS)
  .map(([name, attrs]) => `<${name}${attrs.map((a) => ` ${a}="…"`).join('')}>`)
  .join(', ')

/**
 * The statement a new question starts with. Only the prose is translated; the MDX syntax and the
 * sample stay as they are. The page shows the title above the statement, so it has no heading.
 */
function starterStatement(intro: string, noteTitle: string): string {
  return `${intro}

\`\`\`python
print("a code block")
\`\`\`

<Note title="${noteTitle}">1 ≤ n ≤ 1000</Note>

<Sample input="1 2" output="3" />
`
}

/** The page for both creating (no `id`) and editing a question. */
export function QuestionEditor({ id }: { id?: string }) {
  const t = useTranslations('QuestionEditor')
  const tCommon = useTranslations('Common')
  const errorMessage = useErrorMessage()
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: questionKey(id ?? ''),
    queryFn: () => fetchQuestion(id as string),
    enabled: id !== undefined,
  })

  if (id === undefined) return <QuestionForm initial={null} />
  if (isPending) return <EditorSkeleton />
  if (error) {
    return (
      <div className="grid justify-items-start gap-3">
        <FormError>{t('loadFailed', { detail: errorMessage(error) })}</FormError>
        <Button variant="outline" onClick={() => refetch()} loading={isFetching}>
          {tCommon('tryAgain')}
        </Button>
      </div>
    )
  }
  return <QuestionForm key={id} initial={data} />
}

function EditorSkeleton() {
  const t = useTranslations('QuestionEditor')
  return (
    <div className="grid gap-6" role="status" aria-label={t('loading')}>
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="grid gap-4">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-72" />
        </div>
        <Skeleton className="h-72" />
      </div>
    </div>
  )
}

/** Compiles the MDX on the server a moment after the author stops typing. */
function useLivePreview(mdx: string) {
  const t = useTranslations('QuestionEditor')
  const errorMessage = useErrorMessage()
  const [result, setResult] = useState<MdxPreviewResult | null>(null)
  useEffect(() => {
    let current = true
    const timer = setTimeout(async () => {
      try {
        const res = await createApiClient().questions.preview.$post({ json: { mdx } })
        if (!res.ok) throw await readApiError(res)
        const body = await res.json()
        if (current) setResult(body)
      } catch (e) {
        if (current) {
          setResult({
            ok: false,
            error: { message: e instanceof Error ? errorMessage(e) : t('previewFailed') },
          })
        }
      }
    }, 350)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [mdx])
  return result
}

function parseTags(text: string): string[] {
  return text
    .split(/[,\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function QuestionForm({ initial }: { initial: QuestionDetail | null }) {
  const t = useTranslations('QuestionEditor')
  const tCommon = useTranslations('Common')
  const tComparison = useTranslations('Comparison')
  const errorMessage = useErrorMessage()
  const difficultyOptions = useDifficultyOptions()
  const comparisonOptions = COMPARISON_RULES.map((value) => ({
    value,
    label: tComparison(`label.${value}`),
  }))
  const router = useRouter()
  const queryClient = useQueryClient()
  const [mdx, setMdx] = useState(
    initial?.statementMdx ?? starterStatement(t('starterIntro'), t('starterNoteTitle')),
  )
  const [comparison, setComparison] = useState<ComparisonRule>(initial?.comparison ?? 'trimmed')
  const [error, setError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const preview = useLivePreview(mdx)

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const json = {
        title: String(form.get('title') ?? ''),
        statementMdx: mdx,
        tags: parseTags(String(form.get('tags') ?? '')),
        difficulty: String(form.get('difficulty')) as 'easy' | 'medium' | 'hard',
        timeLimitMs: Number(form.get('timeLimitMs')),
        memoryLimitMb: Number(form.get('memoryLimitMb')),
        maxScore: Number(form.get('maxScore')),
        comparison: String(form.get('comparison')) as ComparisonRule,
      }
      const api = createApiClient().questions
      if (initial) {
        const res = await api[':id'].$patch({ param: { id: initial.id }, json })
        if (!res.ok) throw await readApiError(res)
        return (await res.json()).question
      }
      const res = await api.$post({ json })
      if (!res.ok) throw await readApiError(res)
      return (await res.json()).question
    },
    onSuccess: async (question) => {
      setError('')
      toast.success(initial ? tCommon('changesSaved') : t('created'), {
        description: question.title,
      })
      queryClient.setQueryData(questionKey(question.id), question)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUESTIONS_KEY }),
        queryClient.invalidateQueries({ queryKey: studentViewKey(question.id) }),
      ])
      // A new question continues on its own page, where tests can be added.
      if (!initial) router.replace(`/admin/questions/${question.id}`)
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: async () => {
      const res = await createApiClient().questions[':id'].$delete({
        param: { id: (initial as QuestionDetail).id },
      })
      await ensureOk(res)
    },
    onSuccess: async () => {
      toast.success(t('deleted'), { description: initial?.title })
      await queryClient.invalidateQueries({ queryKey: QUESTIONS_KEY })
      router.push('/admin/questions')
    },
    onError: (e) => {
      setConfirmingDelete(false)
      toast.error(t('deleteFailed'), { description: errorMessage(e) })
    },
  })

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="grid justify-items-start gap-2">
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <Link href="/admin/questions">
            <ArrowLeft className="rtl:-scale-x-100" aria-hidden />
            {t('back')}
          </Link>
        </Button>
        <PageHeader
          title={initial ? t('titleEdit') : t('titleNew')}
          description={initial ? undefined : t('descriptionNew')}
        />
      </div>
      {initial ? (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/questions/${initial.id}/preview`}>
              <Eye aria-hidden />
              {tCommon('studentPreview')}
            </Link>
          </Button>
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 aria-hidden />
            {tCommon('delete')}
          </Button>
        </div>
      ) : null}

      <form
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault()
          setError('')
          save.mutate(new FormData(e.currentTarget))
        }}
      >
        <div className="grid min-w-0 content-start gap-4">
          <TextField
            label={t('fieldTitle')}
            name="title"
            defaultValue={initial?.title ?? ''}
            required
            maxLength={QUESTION_LIMITS.titleMax}
          />
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <SelectField
              label={t('fieldDifficulty')}
              name="difficulty"
              defaultValue={initial?.difficulty ?? 'medium'}
              options={difficultyOptions}
            />
            <TextField
              label={t('fieldTags')}
              name="tags"
              defaultValue={initial?.tags.join(', ') ?? ''}
              hint={t('fieldTagsHint')}
              autoCapitalize="none"
              spellCheck={false}
            />
            <TextField
              label={t('fieldTimeLimit')}
              name="timeLimitMs"
              type="number"
              inputMode="numeric"
              defaultValue={initial?.timeLimitMs ?? QUESTION_LIMITS.timeLimitMs.default}
              min={QUESTION_LIMITS.timeLimitMs.min}
              max={QUESTION_LIMITS.timeLimitMs.max}
              required
            />
            <TextField
              label={t('fieldMemoryLimit')}
              name="memoryLimitMb"
              type="number"
              inputMode="numeric"
              defaultValue={initial?.memoryLimitMb ?? QUESTION_LIMITS.memoryLimitMb.default}
              min={QUESTION_LIMITS.memoryLimitMb.min}
              max={QUESTION_LIMITS.memoryLimitMb.max}
              required
            />
            <TextField
              label={t('fieldMaxScore')}
              name="maxScore"
              type="number"
              inputMode="numeric"
              defaultValue={initial?.maxScore ?? QUESTION_LIMITS.maxScore.default}
              min={QUESTION_LIMITS.maxScore.min}
              max={QUESTION_LIMITS.maxScore.max}
              required
            />
            <SelectField
              label={t('fieldComparison')}
              name="comparison"
              defaultValue={comparison}
              options={comparisonOptions}
              hint={tComparison(`hint.${comparison}`)}
              onValueChange={(value) => setComparison(value as ComparisonRule)}
            />
          </div>
          <TextareaField
            label={t('fieldStatement')}
            hint={t('mdxHint', { components: MDX_COMPONENT_LIST })}
            value={mdx}
            onChange={(e) => setMdx(e.target.value)}
            dir="ltr"
            spellCheck={false}
            rows={20}
            maxLength={QUESTION_LIMITS.statementMax}
            className="min-h-80 font-mono"
          />
          <FormError>{error}</FormError>
          <div>
            <Button type="submit" loading={save.isPending}>
              {initial ? tCommon('saveChanges') : t('submitCreate')}
            </Button>
          </div>
        </div>

        <section aria-labelledby="live-preview" className="min-w-0 content-start">
          <h2 id="live-preview" className="mb-2 text-base">
            {t('livePreview')}
          </h2>
          <div aria-label={t('previewLabel')} className="min-h-40 rounded-lg border bg-card p-4">
            {preview === null ? (
              <div className="grid gap-2" role="status" aria-label={t('compiling')}>
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : preview.ok ? (
              <MdxContent compiled={preview.compiled} />
            ) : (
              <FormError>
                {preview.error.line
                  ? preview.error.column
                    ? t('invalidStatementLineColumn', {
                        line: preview.error.line,
                        column: preview.error.column,
                        message: preview.error.message,
                      })
                    : t('invalidStatementLine', {
                        line: preview.error.line,
                        message: preview.error.message,
                      })
                  : t('invalidStatement', { message: preview.error.message })}
              </FormError>
            )}
          </div>
        </section>
      </form>

      <section aria-labelledby="tests-heading" className="grid gap-3">
        <h2 id="tests-heading" className="text-xl">
          {t('testsTitle')}
        </h2>
        {initial ? (
          <TestCasesEditor questionId={initial.id} />
        ) : (
          <p className="text-sm text-muted-foreground">{t('testsAfterCreate')}</p>
        )}
      </section>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={initial ? t('deleteTitle', { title: initial.title }) : t('deleteTitleFallback')}
        description={t('deleteDescription', { count: initial?.tests.length ?? 0 })}
        confirmLabel={t('deleteConfirm')}
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  )
}
