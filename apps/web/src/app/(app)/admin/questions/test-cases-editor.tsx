'use client'

import { QUESTION_LIMITS, type TestCase } from '@bot-arena/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, EyeOff, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CheckboxField, FormError, TextareaField } from '@/components/form-parts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { createApiClient } from '@/lib/api'
import { ensureOk, fetchQuestion, QUESTIONS_KEY, questionKey, studentViewKey } from './api'

type Draft = { visible: boolean; stdin: string; expectedOutput: string }

const dataClass = 'min-h-24 font-mono'

/** Sample (visible) and hidden tests of one question: add, edit, reorder and delete. */
export function TestCasesEditor({ questionId }: { questionId: string }) {
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
      toast.success('Test added')
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
    onError: (e) => toast.error('Could not reorder the tests', { description: e.message }),
  })

  if (isPending) {
    return (
      <div className="grid gap-3" role="status" aria-label="Loading tests">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="grid justify-items-start gap-3">
        <FormError>Could not load tests: {error.message}</FormError>
        <Button variant="outline" onClick={() => refetch()} loading={isFetching}>
          Try again
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
        Each test is a program input (stdin) and the expected output. Sample tests are shown to
        students. Hidden tests are only used for grading and never leave the server.{' '}
        <span data-numeric>
          {samples} sample, {tests.length - samples} hidden.
        </span>
      </p>

      {tests.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6">
          <h3 className="text-base font-semibold">No tests yet</h3>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Add a sample test students can see, then hidden tests for grading.
          </p>
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
          This question has the maximum of {QUESTION_LIMITS.testsPerQuestionMax} tests.
        </p>
      )}
    </div>
  )
}

function KindBadge({ visible }: { visible: boolean }) {
  return visible ? (
    <Badge variant="success">Sample</Badge>
  ) : (
    <Badge variant="outline">
      <EyeOff aria-hidden />
      Hidden
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
      toast.success('Test saved', { description: `Test ${number}` })
      return onChanged()
    },
    onError: (e) => setError(e.message),
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
      toast.success('Test deleted', { description: `Test ${number}` })
      return onChanged()
    },
    onError: (e) => {
      setConfirmingDelete(false)
      toast.error('Could not delete the test', { description: e.message })
    },
  })

  return (
    <div className="grid gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold">Test {number}</h3>
          <KindBadge visible={test.visible} />
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Move test ${number} up`}
            disabled={!canMoveUp || busy}
            onClick={() => onMove(-1)}
          >
            <ArrowUp aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Move test ${number} down`}
            disabled={!canMoveDown || busy}
            onClick={() => onMove(1)}
          >
            <ArrowDown aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            aria-label={`Delete test ${number}`}
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextareaField
          label="Input (stdin)"
          value={draft.stdin}
          onChange={(e) => setDraft({ ...draft, stdin: e.target.value })}
          dir="ltr"
          spellCheck={false}
          className={dataClass}
        />
        <TextareaField
          label="Expected output"
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
          label="Sample (visible to students)"
          checked={draft.visible}
          onCheckedChange={(visible) => setDraft({ ...draft, visible })}
        />
        <Button disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
          Save test
        </Button>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete test ${number}?`}
        description="The test is removed from the question and from grading. It cannot be undone."
        confirmLabel="Delete test"
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
          setError(err instanceof Error ? err.message : 'Could not add the test')
        }
      }}
    >
      <h3 className="text-base font-semibold">Add a test</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextareaField
          label="Input (stdin)"
          value={draft.stdin}
          onChange={(e) => setDraft({ ...draft, stdin: e.target.value })}
          dir="ltr"
          spellCheck={false}
          className={dataClass}
        />
        <TextareaField
          label="Expected output"
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
          label="Sample (visible to students)"
          checked={draft.visible}
          onCheckedChange={(visible) => setDraft({ ...draft, visible })}
        />
        <Button type="submit" loading={add.isPending}>
          Add test
        </Button>
      </div>
    </form>
  )
}
