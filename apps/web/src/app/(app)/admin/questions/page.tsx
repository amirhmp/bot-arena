import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { QuestionsView } from './questions-view'

export const metadata: Metadata = { title: 'Questions' }

export default function QuestionsPage() {
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Question bank"
        description="Write questions in MDX with sample and hidden tests. Quizzes pick their questions from here."
        action={
          <Button asChild>
            <Link href="/admin/questions/new">
              <Plus aria-hidden />
              New question
            </Link>
          </Button>
        }
      />
      <QuestionsView />
    </div>
  )
}
