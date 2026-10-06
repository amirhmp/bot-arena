import { usernameClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { apiBaseUrl } from './api'

/** Better Auth client for sign-in, sign-out and password change. Cookies travel with every call. */
export const authClient = createAuthClient({
  baseURL: apiBaseUrl(),
  basePath: '/auth',
  plugins: [usernameClient()],
  fetchOptions: { credentials: 'include' },
})
