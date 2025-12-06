import {Database} from 'sqlite'

declare module 'speed-framework' {
  const db: Database
}

declare module 'hono' {
  interface ContextVariableMap {
    // Will be automatically injected by the framework
    userId?: string
    userToken?: string
  }
}
