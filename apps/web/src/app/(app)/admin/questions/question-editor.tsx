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
import { ensureOk, fetchQuestion, QUESTIONS_KEY, questionKey, studentViewKey } from './api'
import { DIFFICULTY_OPTIONS } from './difficulty-badge'
import { TestCasesEditor } from './test-cases-editor'

// The page shows the title above the statement, so the statement does not start with a heading.
const STARTER = `Describe the task here. Markdown works: **bold**, \`code\`, lists and tables.

\`\`\`python
print("a code block")
\`\`\`

<Note title="Constraints">1 ≤ n ≤ 1000</Note>

<Sample input="1 2" output="3" />
`

const COMPARISON_LABEL = {
  trimmed: 'Trimmed (default)',
  strict: 'Strict',
  token: 'Token by token',
} as const satisfies Record<ComparisonRule, string>
const COMPARISON_HINT: Record<ComparisonRule, string> = {
  trimmed: 'Exact match after trimming whitespace at the ends.',
  strict: 'Byte for byte.',
  token: 'The same whitespace-separated tokens in the same order.',
}
const COMPARISON_OPTIONS = COMPARISON_RULES.map((value) => ({
  value,
  label: COMPARISON_LABEL[value],
}))

const MDX_HINT = `Components: ${Object.entries(MDX_COMPONENTS)
  .map(([name, attrs]) => `<${name}${attrs.map((a) => ` ${a}="…"`).join('')}>`)
  .join(', ')}. No imports or { } expressions.`

/** The page for both creating (no `id`) and editing a question. */
export function QuestionEditor({ id }: { id?: string }) {
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
        <FormError>Could not load the question: {error.message}</FormError>
        <Button variant="outline" onClick={() => refetch()} loading={isFetching}>
          Try again
        </Button>
      </div>
    )
  }
  return <QuestionForm key={id} initial={data} />
}

function EditorSkeleton() {
  return (
    <div className="grid gap-6" role="status" aria-label="Loading question">
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
  const [result, setResult] = useState<MdxPreviewResult | null>(null)
  useEffect(() => {
    let current = true
    const timer = setTimeout(async () => {
      try {
        const res = await createApiClient().questions.preview.$post({ json: { mdx } })
        if (!res.ok) throw new Error(await readApiError(res))
        const body = await res.json()
        if (current) setResult(body)
      } catch (e) {
        if (current) {
          setResult({
            ok: false,
            error: { message: e instanceof Error ? e.message : 'The preview failed' },
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
  const router = useRouter()
  const queryClient = useQueryClient()
  const [mdx, setMdx] = useState(initial?.statementMdx ?? STARTER)
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
        if (!res.ok) throw new Error(await readApiError(res))
        return (await res.json()).question
      }
      const res = await api.$post({ json })
      if (!res.ok) throw new Error(await readApiError(res))
      return (await res.json()).question
    },
    onSuccess: async (question) => {
      setError('')
      toast.success(initial ? 'Changes saved' : 'Question created', {
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
    onError: (e) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: async () => {
      const res = await createApiClient().questions[':id'].$delete({
        param: { id: (initial as QuestionDetail).id },
      })
      await ensureOk(res)
    },
    onSuccess: async () => {
      toast.success('Question deleted', { description: initial?.title })
      await queryClient.invalidateQueries({ queryKey: QUESTIONS_KEY })
      router.push('/admin/questions')
    },
    onError: (e) => {
      setConfirmingDelete(false)
      toast.error('Could not delete the question', { description: e.message })
    },
  })

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="grid justify-items-start gap-2">
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <Link href="/admin/questions">
            <ArrowLeft className="rtl:-scale-x-100" aria-hidden />
            Question bank
          </Link>
        </Button>
        <PageHeader
          title={initial ? 'Edit question' : 'New question'}
          description={
            initial
              ? undefined
              : 'Write the statement and set the limits. You add tests once the question is created.'
          }
        />
      </div>
      {initial ? (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/questions/${initial.id}/preview`}>
              <Eye aria-hidden />
              Student preview
            </Link>
          </Button>
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 aria-hidden />
            Delete
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
            label="Title"
            name="title"
            defaultValue={initial?.title ?? ''}
            required
            maxLength={QUESTION_LIMITS.titleMax}
          />
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <SelectField
              label="Difficulty"
              name="difficulty"
              defaultValue={initial?.difficulty ?? 'medium'}
              options={DIFFICULTY_OPTIONS}
            />
            <TextField
              label="Tags"
              name="tags"
              defaultValue={initial?.tags.join(', ') ?? ''}
              hint="Separated by commas, for example graphs, dp."
              autoCapitalize="none"
              spellCheck={false}
            />
            <TextField
              label="Time limit per test (ms)"
              name="timeLimitMs"
              type="number"
              inputMode="numeric"
              defaultValue={initial?.timeLimitMs ?? QUESTION_LIMITS.timeLimitMs.default}
              min={QUESTION_LIMITS.timeLimitMs.min}
              max={QUESTION_LIMITS.timeLimitMs.max}
              required
            />
            <TextField
              label="Memory limit (MB)"
              name="memoryLimitMb"
              type="number"
              inputMode="numeric"
              defaultValue={initial?.memoryLimitMb ?? QUESTION_LIMITS.memoryLimitMb.default}
              min={QUESTION_LIMITS.memoryLimitMb.min}
              max={QUESTION_LIMITS.memoryLimitMb.max}
              required
            />
            <TextField
              label="Max score"
              name="maxScore"
              type="number"
              inputMode="numeric"
              defaultValue={initial?.maxScore ?? QUESTION_LIMITS.maxScore.default}
              min={QUESTION_LIMITS.maxScore.min}
              max={QUESTION_LIMITS.maxScore.max}
              required
            />
            <SelectField
              label="Output comparison"
              name="comparison"
              defaultValue={comparison}
              options={COMPARISON_OPTIONS}
              hint={COMPARISON_HINT[comparison]}
              onValueChange={(value) => setComparison(value as ComparisonRule)}
            />
          </div>
          <TextareaField
            label="Statement (MDX)"
            hint={MDX_HINT}
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
              {initial ? 'Save changes' : 'Create question'}
            </Button>
          </div>
        </div>

        <section aria-labelledby="live-preview" className="min-w-0 content-start">
          <h2 id="live-preview" className="mb-2 text-base">
            Live preview
          </h2>
          <div aria-label="Statement preview" className="min-h-40 rounded-lg border bg-card p-4">
            {preview === null ? (
              <div className="grid gap-2" role="status" aria-label="Compiling the statement">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : preview.ok ? (
              <MdxContent compiled={preview.compiled} />
            ) : (
              <FormError>
                {`This statement cannot be saved${
                  preview.error.line
                    ? ` (line ${preview.error.line}${
                        preview.error.column ? `, column ${preview.error.column}` : ''
                      })`
                    : ''
                }: ${preview.error.message}`}
              </FormError>
            )}
          </div>
        </section>
      </form>

      <section aria-labelledby="tests-heading" className="grid gap-3">
        <h2 id="tests-heading" className="text-xl">
          Tests
        </h2>
        {initial ? (
          <TestCasesEditor questionId={initial.id} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Create the question first, then add sample and hidden tests here.
          </p>
        )}
      </section>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete ${initial?.title ?? 'this question'}?`}
        description={`This permanently deletes the question and its ${
          initial?.tests.length ?? 0
        } tests. It cannot be undone.`}
        confirmLabel="Delete question"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  )
}
