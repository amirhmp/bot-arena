'use client'

import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Eye } from 'lucide-react'
import Link from 'next/link'
import { FormError } from '@/components/form-parts'
import { SampleBlock } from '@/components/mdx-components'
import { MdxContent } from '@/components/mdx-content'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { createApiClient, readApiError } from '@/lib/api'
import { DifficultyBadge } from '../../difficulty-badge'
import { studentViewKey } from '../../api'

/**
 * The question exactly as a student will see it: the compiled statement, the limits and the sample
 * tests. It reads the API's student view, which has no hidden tests in it.
 */
export function StudentPreview({ id }: { id: string }) {
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: studentViewKey(id),
    queryFn: async () => {
      const res = await createApiClient().questions[':id']['student-view'].$get({ param: { id } })
      if (!res.ok) throw new Error(await readApiError(res))
      return (await res.json()).question
    },
  })

  if (isPending) {
    return (
      <div className="grid gap-4" role="status" aria-label="Loading the preview">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-96 max-w-full" />
        <Skeleton className="h-48" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="grid justify-items-start gap-3">
        <FormError>Could not load the preview: {error.message}</FormError>
        <Button variant="outline" onClick={() => refetch()} loading={isFetching}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-signal bg-signal/10 p-3 text-sm">
        <span className="flex items-center gap-2">
          <Eye className="size-4" aria-hidden />
          Student preview: this is how the question looks to students.
        </span>
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/questions/${id}`}>
            <ArrowLeft className="rtl:-scale-x-100" aria-hidden />
            Back to editor
          </Link>
        </Button>
      </div>

      <article className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6">
        <PageHeader
          title={data.title}
          description={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1" data-numeric>
              <DifficultyBadge difficulty={data.difficulty} />
              <span>Time limit {data.timeLimitMs / 1000} s</span>
              <span>Memory limit {data.memoryLimitMb} MB</span>
              <span>{data.maxScore} points</span>
              {data.tags.length > 0 ? <span>{data.tags.join(', ')}</span> : null}
            </span>
          }
        />
        <MdxContent compiled={data.statementCompiled} />
        {data.samples.length > 0 ? (
          <section aria-labelledby="samples-heading">
            <h2 id="samples-heading" className="text-xl">
              Sample tests
            </h2>
            {data.samples.map((sample, index) => (
              <SampleBlock
                key={sample.id}
                title={`Sample ${index + 1}`}
                input={sample.stdin}
                output={sample.expectedOutput}
              />
            ))}
          </section>
        ) : null}
      </article>
    </div>
  )
}
