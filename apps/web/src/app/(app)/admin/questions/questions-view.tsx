'use client'

import { DIFFICULTIES, type Difficulty, type QuestionSummary } from '@bot-arena/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormError } from '@/components/form-parts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createApiClient, readApiError } from '@/lib/api'
import { ensureOk, QUESTIONS_KEY } from './api'
import { DIFFICULTY_OPTIONS, DifficultyBadge } from './difficulty-badge'

type Filters = { q: string; tag: string; difficulty: 'all' | Difficulty }

/** Returns `value` after it has stopped changing for `delay` ms. */
function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

async function fetchQuestions(filters: Filters): Promise<QuestionSummary[]> {
  const res = await createApiClient().questions.$get({
    query: {
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.tag ? { tag: filters.tag } : {}),
      ...(filters.difficulty !== 'all' ? { difficulty: filters.difficulty } : {}),
    },
  })
  if (!res.ok) throw new Error(await readApiError(res))
  return (await res.json()).questions
}

export function QuestionsView() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<Filters>({ q: '', tag: '', difficulty: 'all' })
  const [deleting, setDeleting] = useState<QuestionSummary | null>(null)
  const applied = useDebounced(filters)
  const filtered = applied.q !== '' || applied.tag !== '' || applied.difficulty !== 'all'
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: [...QUESTIONS_KEY, applied],
    queryFn: () => fetchQuestions(applied),
    // Keep the table on screen while a new filter loads, instead of flashing a skeleton.
    placeholderData: (previous) => previous,
  })

  const remove = useMutation({
    mutationFn: async (question: QuestionSummary) => {
      const res = await createApiClient().questions[':id'].$delete({ param: { id: question.id } })
      await ensureOk(res)
    },
    onSuccess: (_result, question) => {
      setDeleting(null)
      toast.success('Question deleted', { description: question.title })
      return queryClient.invalidateQueries({ queryKey: QUESTIONS_KEY })
    },
    onError: (e) => toast.error('Could not delete the question', { description: e.message }),
  })

  const filterBar = (
    <div className="flex flex-wrap gap-2">
      <Input
        aria-label="Search by title"
        placeholder="Search title"
        value={filters.q}
        onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        className="w-full sm:w-56"
      />
      <Input
        aria-label="Filter by tag"
        placeholder="Tag"
        autoCapitalize="none"
        spellCheck={false}
        value={filters.tag}
        onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
        className="w-full sm:w-36"
      />
      <Select
        value={filters.difficulty}
        onValueChange={(value) =>
          setFilters({ ...filters, difficulty: value as Filters['difficulty'] })
        }
      >
        <SelectTrigger aria-label="Filter by difficulty" className="w-full sm:w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any difficulty</SelectItem>
          {DIFFICULTIES.map((value) => (
            <SelectItem key={value} value={value}>
              {DIFFICULTY_OPTIONS.find((option) => option.value === value)?.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  if (isPending) return <QuestionsSkeleton />

  if (error) {
    return (
      <div className="grid justify-items-start gap-3">
        <FormError>Could not load questions: {error.message}</FormError>
        <Button variant="outline" onClick={() => refetch()} loading={isFetching}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {filterBar}

      {data.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8">
          <h2 className="text-lg">{filtered ? 'No question matches' : 'No questions yet'}</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            {filtered
              ? 'Try a different title, tag or difficulty, or clear the filters.'
              : 'Create the first question, then add sample and hidden tests to it.'}
          </p>
          {filtered ? null : (
            <Button asChild className="mt-4">
              <Link href="/admin/questions/new">
                <Plus aria-hidden />
                New question
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" data-numeric>
            {data.length === 1 ? '1 question' : `${data.length} questions`}
          </p>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Title</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Tests</TableHead>
                  <TableHead>Max score</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((question) => (
                  <TableRow key={question.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/questions/${question.id}`}
                        className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {question.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <DifficultyBadge difficulty={question.difficulty} />
                    </TableCell>
                    <TableCell>
                      <span className="flex gap-1">
                        {question.tags.length === 0 ? (
                          <span className="text-muted-foreground">None</span>
                        ) : (
                          question.tags.map((tag) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {question.sampleCount} sample, {question.hiddenCount} hidden
                    </TableCell>
                    <TableCell>{question.maxScore}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(question.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Actions for ${question.title}`}
                          >
                            <MoreHorizontal aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/questions/${question.id}`}>
                              <Pencil aria-hidden />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/questions/${question.id}/preview`}>
                              <Eye aria-hidden />
                              Student preview
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDeleting(question)}
                          >
                            <Trash2 aria-hidden />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete ${deleting?.title ?? 'this question'}?`}
        description={`This permanently deletes the question and its ${
          deleting ? deleting.sampleCount + deleting.hiddenCount : 0
        } tests. It cannot be undone.`}
        confirmLabel="Delete question"
        destructive
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  )
}

function QuestionsSkeleton() {
  return (
    <div className="grid gap-3" role="status" aria-label="Loading questions">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="divide-y rounded-lg border bg-card">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-6 px-3 py-3.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
