/// <reference types="vite/client" />

export interface SpeedAuthData {
  token: string // Will be automatically attached to all requests to the backend
  user: {
    id: string // User's unique ID
    name: string
    photoUrl: string
  }
}

export type FileBody = ReadableStream | Blob | BufferSource | string

export interface SpeedSDK {
  auth: {
    // Get the current authenticated user
    // Set `autoRedirect` to `true` to redirect to login page if not authenticated
    getCurrentUser(autoRedirect?: boolean): Promise<SpeedAuthData | null>
    // Redirect to login page to let the user login
    login(): void
    // Log out the current user and reload the page
    logout(): void
  }

  upload: {
    // Upload a file and get file's URL
    uploadFile(file: FileBody): Promise<{url: string}>
  }

  llm: {
    // Get a API URL to use with @ai-sdk/react
    // The returned URL should be use with `useCompletion` or `useChat` from `@ai-sdk/react`, rather than directly used with `fetch`
    getEndpoint(model: string): string
  }
}

declare global {
  // Speed SDK global instance, only available in frontend
  const speed: SpeedSDK
}
