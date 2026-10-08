'use client'

import { DIFFICULTIES, type Difficulty, type QuestionSummary } from '@bot-arena/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
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
import { useErrorMessage } from '@/lib/use-error-message'
import { ensureOk, QUESTIONS_KEY } from './api'
import { DifficultyBadge, useDifficultyOptions } from './difficulty-badge'

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
  if (!res.ok) throw await readApiError(res)
  return (await res.json()).questions
}

export function QuestionsView() {
  const t = useTranslations('Questions')
  const tCommon = useTranslations('Common')
  const format = useFormatter()
  const errorMessage = useErrorMessage()
  const difficultyOptions = useDifficultyOptions()
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
      toast.success(t('deleted'), { description: question.title })
      return queryClient.invalidateQueries({ queryKey: QUESTIONS_KEY })
    },
    onError: (e) => toast.error(t('deleteFailed'), { description: errorMessage(e) }),
  })

  const filterBar = (
    <div className="flex flex-wrap gap-2">
      <Input
        aria-label={t('searchLabel')}
        placeholder={t('searchPlaceholder')}
        value={filters.q}
        onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        className="w-full sm:w-56"
      />
      <Input
        aria-label={t('tagLabel')}
        placeholder={t('tagPlaceholder')}
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
        <SelectTrigger aria-label={t('difficultyLabel')} className="w-full sm:w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('anyDifficulty')}</SelectItem>
          {DIFFICULTIES.map((value) => (
            <SelectItem key={value} value={value}>
              {difficultyOptions.find((option) => option.value === value)?.label}
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
        <FormError>{t('loadFailed', { detail: errorMessage(error) })}</FormError>
        <Button variant="outline" onClick={() => refetch()} loading={isFetching}>
          {tCommon('tryAgain')}
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {filterBar}

      {data.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8">
          <h2 className="text-lg">{filtered ? t('noMatchTitle') : t('emptyTitle')}</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            {filtered ? t('noMatchText') : t('emptyText')}
          </p>
          {filtered ? null : (
            <Button asChild className="mt-4">
              <Link href="/admin/questions/new">
                <Plus aria-hidden />
                {t('newQuestion')}
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" data-numeric>
            {t('count', { count: data.length })}
          </p>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('colTitle')}</TableHead>
                  <TableHead>{t('colDifficulty')}</TableHead>
                  <TableHead>{t('colTags')}</TableHead>
                  <TableHead>{t('colTests')}</TableHead>
                  <TableHead>{t('colMaxScore')}</TableHead>
                  <TableHead>{t('colUpdated')}</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">{tCommon('actions')}</span>
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
                          <span className="text-muted-foreground">{tCommon('none')}</span>
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
                      {t('testCounts', {
                        samples: question.sampleCount,
                        hidden: question.hiddenCount,
                      })}
                    </TableCell>
                    <TableCell>{format.number(question.maxScore)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format.dateTime(new Date(question.updatedAt), { dateStyle: 'medium' })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={t('actionsFor', { title: question.title })}
                          >
                            <MoreHorizontal aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/questions/${question.id}`}>
                              <Pencil aria-hidden />
                              {tCommon('edit')}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/questions/${question.id}/preview`}>
                              <Eye aria-hidden />
                              {tCommon('studentPreview')}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDeleting(question)}
                          >
                            <Trash2 aria-hidden />
                            {tCommon('delete')}
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
        title={deleting ? t('deleteTitle', { title: deleting.title }) : t('deleteTitleFallback')}
        description={t('deleteDescription', {
          count: deleting ? deleting.sampleCount + deleting.hiddenCount : 0,
        })}
        confirmLabel={t('deleteConfirm')}
        destructive
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  )
}

function QuestionsSkeleton() {
  const t = useTranslations('Questions')
  return (
    <div className="grid gap-3" role="status" aria-label={t('loading')}>
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
