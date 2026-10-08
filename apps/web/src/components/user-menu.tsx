'use client'

import type { SessionUser } from '@bot-arena/shared'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { LocaleRadioGroup } from '@/components/locale-switcher'
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
  const t = useTranslations('UserMenu')
  const tApp = useTranslations('App')
  const tRoles = useTranslations('Roles')
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
      toast.error(t('signOutFailedTitle'), { description: t('signOutFailedDescription') })
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
            aria-label={t('accountMenuFor', { name: user.name })}
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
              <Badge variant="secondary">{tRoles(user.role)}</Badge>
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/account">
              <UserRound aria-hidden />
              {t('account')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {t('theme')}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={setTheme}>
            <DropdownMenuRadioItem value="light">
              <Sun aria-hidden />
              {t('light')}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon aria-hidden />
              {t('dark')}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <Monitor aria-hidden />
              {t('system')}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {t('language')}
          </DropdownMenuLabel>
          <LocaleRadioGroup />
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirmOpen(true)}>
            <LogOut aria-hidden />
            {t('signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('signOutTitle', { app: tApp('name') })}
        description={t('signOutDescription')}
        confirmLabel={t('signOut')}
        pending={pending}
        onConfirm={signOut}
      />
    </>
  )
}
