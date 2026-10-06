'use client'

import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from './ui'
import { authClient } from '@/lib/auth-client'

export function SignOutButton() {
  const router = useRouter()
  const queryClient = useQueryClient()

  async function signOut() {
    await authClient.signOut()
    queryClient.clear()
    router.replace('/login')
    router.refresh()
  }

  return (
    <Button variant="secondary" onClick={signOut}>
      Sign out
    </Button>
  )
}
