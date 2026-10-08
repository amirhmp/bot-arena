'use client'

import { QUESTION_LIMITS, type TestCase } from '@bot-arena/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, EyeOff, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CheckboxField, FormError, TextareaField } from '@/components/form-parts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { createApiClient } from '@/lib/api'
import { useErrorMessage } from '@/lib/use-error-message'
import { ensureOk, fetchQuestion, QUESTIONS_KEY, questionKey, studentViewKey } from './api'

type Draft = { visible: boolean; stdin: string; expectedOutput: string }

const dataClass = 'min-h-24 font-mono'

/** Sample (visible) and hidden tests of one question: add, edit, reorder and delete. */
export function TestCasesEditor({ questionId }: { questionId: string }) {
  const t = useTranslations('TestCases')
  const tCommon = useTranslations('Common')
  const errorMessage = useErrorMessage()
  const queryClient = useQueryClient()
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: questionKey(questionId),
    queryFn: () => fetchQuestion(questionId),
  })

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: questionKey(questionId) }),
      queryClient.invalidateQueries({ queryKey: studentViewKey(questionId) }),
      queryClient.invalidateQueries({ queryKey: QUESTIONS_KEY }),
    ])
  }

  const add = useMutation({
    mutationFn: async (draft: Draft) => {
      const res = await createApiClient().questions[':id'].tests.$post({
        param: { id: questionId },
        json: draft,
      })
      await ensureOk(res)
    },
    onSuccess: () => {
      toast.success(t('added'))
      return refresh()
    },
  })

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await createApiClient().questions[':id'].tests.order.$put({
        param: { id: questionId },
        json: { ids },
      })
      await ensureOk(res)
    },
    onSuccess: () => refresh(),
    onError: (e) => toast.error(t('reorderFailed'), { description: errorMessage(e) }),
  })

  if (isPending) {
    return (
      <div className="grid gap-3" role="status" aria-label={t('loading')}>
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    )
  }
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

  const tests = data.tests
  const samples = tests.filter((test) => test.visible).length
  const move = (index: number, delta: -1 | 1) => {
    const ids = tests.map((test) => test.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + delta, 0, moved as string)
    reorder.mutate(ids)
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <p className="max-w-prose text-sm text-muted-foreground">
        {t('intro')}{' '}
        <span data-numeric>{t('counts', { samples, hidden: tests.length - samples })}</span>
      </p>

      {tests.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6">
          <h3 className="text-base font-semibold">{t('emptyTitle')}</h3>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{t('emptyText')}</p>
        </div>
      ) : (
        <ol className="grid gap-3">
          {tests.map((test, index) => (
            <li key={test.id}>
              <TestRow
                test={test}
                number={index + 1}
                questionId={questionId}
                canMoveUp={index > 0}
                canMoveDown={index < tests.length - 1}
                busy={reorder.isPending}
                onMove={(delta) => move(index, delta)}
                onChanged={refresh}
              />
            </li>
          ))}
        </ol>
      )}

      {tests.length < QUESTION_LIMITS.testsPerQuestionMax ? (
        <NewTest add={add} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {t('maxReached', { max: QUESTION_LIMITS.testsPerQuestionMax })}
        </p>
      )}
    </div>
  )
}

function KindBadge({ visible }: { visible: boolean }) {
  const t = useTranslations('TestCases')
  return visible ? (
    <Badge variant="success">{t('sample')}</Badge>
  ) : (
    <Badge variant="outline">
      <EyeOff aria-hidden />
      {t('hidden')}
    </Badge>
  )
}

function TestRow({
  test,
  number,
  questionId,
  canMoveUp,
  canMoveDown,
  busy,
  onMove,
  onChanged,
}: {
  test: TestCase
  number: number
  questionId: string
  canMoveUp: boolean
  canMoveDown: boolean
  busy: boolean
  onMove: (delta: -1 | 1) => void
  onChanged: () => Promise<unknown>
}) {
  const t = useTranslations('TestCases')
  const errorMessage = useErrorMessage()
  const [draft, setDraft] = useState<Draft>({
    visible: test.visible,
    stdin: test.stdin,
    expectedOutput: test.expectedOutput,
  })
  const [error, setError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const dirty =
    draft.visible !== test.visible ||
    draft.stdin !== test.stdin ||
    draft.expectedOutput !== test.expectedOutput

  const save = useMutation({
    mutationFn: async () => {
      const res = await createApiClient().questions[':id'].tests[':testId'].$patch({
        param: { id: questionId, testId: test.id },
        json: draft,
      })
      await ensureOk(res)
    },
    onSuccess: () => {
      setError('')
      toast.success(t('saved'), { description: t('testNumber', { number }) })
      return onChanged()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: async () => {
      const res = await createApiClient().questions[':id'].tests[':testId'].$delete({
        param: { id: questionId, testId: test.id },
      })
      await ensureOk(res)
    },
    onSuccess: () => {
      setConfirmingDelete(false)
      toast.success(t('deleted'), { description: t('testNumber', { number }) })
      return onChanged()
    },
    onError: (e) => {
      setConfirmingDelete(false)
      toast.error(t('deleteFailed'), { description: errorMessage(e) })
    },
  })

  return (
    <div className="grid gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold">{t('testNumber', { number })}</h3>
          <KindBadge visible={test.visible} />
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('moveUp', { number })}
            disabled={!canMoveUp || busy}
            onClick={() => onMove(-1)}
          >
            <ArrowUp aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('moveDown', { number })}
            disabled={!canMoveDown || busy}
            onClick={() => onMove(1)}
          >
            <ArrowDown aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            aria-label={t('deleteAria', { number })}
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextareaField
          label={t('inputLabel')}
          value={draft.stdin}
          onChange={(e) => setDraft({ ...draft, stdin: e.target.value })}
          dir="ltr"
          spellCheck={false}
          className={dataClass}
        />
        <TextareaField
          label={t('outputLabel')}
          value={draft.expectedOutput}
          onChange={(e) => setDraft({ ...draft, expectedOutput: e.target.value })}
          dir="ltr"
          spellCheck={false}
          className={dataClass}
        />
      </div>
      <FormError>{error}</FormError>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CheckboxField
          label={t('sampleCheckbox')}
          checked={draft.visible}
          onCheckedChange={(visible) => setDraft({ ...draft, visible })}
        />
        <Button disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
          {t('save')}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={t('deleteTitle', { number })}
        description={t('deleteDescription')}
        confirmLabel={t('deleteConfirm')}
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  )
}

function NewTest({
  add,
}: {
  add: { isPending: boolean; mutateAsync: (draft: Draft) => Promise<unknown> }
}) {
  const t = useTranslations('TestCases')
  const errorMessage = useErrorMessage()
  const [draft, setDraft] = useState<Draft>({ visible: true, stdin: '', expectedOutput: '' })
  const [error, setError] = useState('')

  return (
    <form
      className="grid gap-3 rounded-lg border border-dashed p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setError('')
        try {
          await add.mutateAsync(draft)
          // Keep the visibility choice: tests are usually added in runs of one kind.
          setDraft({ visible: draft.visible, stdin: '', expectedOutput: '' })
        } catch (err) {
          // Keep the draft so nothing typed is lost.
          setError(err instanceof Error ? errorMessage(err) : t('addFailed'))
        }
      }}
    >
      <h3 className="text-base font-semibold">{t('addTitle')}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextareaField
          label={t('inputLabel')}
          value={draft.stdin}
          onChange={(e) => setDraft({ ...draft, stdin: e.target.value })}
          dir="ltr"
          spellCheck={false}
          className={dataClass}
        />
        <TextareaField
          label={t('outputLabel')}
          value={draft.expectedOutput}
          onChange={(e) => setDraft({ ...draft, expectedOutput: e.target.value })}
          dir="ltr"
          spellCheck={false}
          className={dataClass}
        />
      </div>
      <FormError>{error}</FormError>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CheckboxField
          label={t('sampleCheckbox')}
          checked={draft.visible}
          onCheckedChange={(visible) => setDraft({ ...draft, visible })}
        />
        <Button type="submit" loading={add.isPending}>
          {t('addSubmit')}
        </Button>
      </div>
    </form>
  )
}
