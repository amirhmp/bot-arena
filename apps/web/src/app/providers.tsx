'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Direction } from 'radix-ui'
import { useState, type ReactNode } from 'react'
import { Toaster } from '@/components/ui/sonner'
import type { Direction as Dir } from '@/lib/direction'

export function Providers({ children, dir }: { children: ReactNode; dir: Dir }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: 1 } } }),
  )
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {/* Radix needs the direction too: menus, selects and keyboard navigation follow it. */}
      <Direction.Provider dir={dir}>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster dir={dir} />
        </QueryClientProvider>
      </Direction.Provider>
    </ThemeProvider>
  )
}
