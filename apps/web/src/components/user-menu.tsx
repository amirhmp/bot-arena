'use client'

import type { SessionUser } from '@bot-arena/shared'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authClient } from '@/lib/auth-client'

function initialOf(name: string): string {
  const [first] = name.trim()
  return first ? first.toUpperCase() : '?'
}

/** Account menu: profile link, theme choice and sign-out, which asks for confirmation first. */
export function UserMenu({ user }: { user: SessionUser }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { theme, setTheme } = useTheme()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function signOut() {
    setPending(true)
    const { error } = await authClient.signOut()
    if (error) {
      setPending(false)
      toast.error('Could not sign out', { description: 'Check your connection and try again.' })
      return
    }
    queryClient.clear()
    router.replace('/login')
    router.refresh()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-9 gap-2 px-2"
            aria-label={`Account menu for ${user.name}`}
          >
            <span
              aria-hidden
              className="grid size-6 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
            >
              {initialOf(user.name)}
            </span>
            <span className="hidden max-w-32 truncate sm:inline">{user.name}</span>
            <ChevronDown className="text-muted-foreground" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="grid gap-1">
            <span className="truncate">{user.name}</span>
            <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
              <span className="truncate">{user.username}</span>
              <Badge variant="secondary">{user.role}</Badge>
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/account">
              <UserRound aria-hidden />
              Account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Theme
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={setTheme}>
            <DropdownMenuRadioItem value="light">
              <Sun aria-hidden />
              Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon aria-hidden />
              Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <Monitor aria-hidden />
              System
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirmOpen(true)}>
            <LogOut aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Sign out of Bot Arena?"
        description="You will need your username and password to sign in again."
        confirmLabel="Sign out"
        pending={pending}
        onConfirm={signOut}
      />
    </>
  )
}
