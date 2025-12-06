import {db} from 'speed-framework'
import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import sql from 'sql-template-strings'
import {EventEmitter} from 'node:events'
import {streamSSE} from 'hono/streaming'
import type {SSEStreamingApi} from 'hono/streaming'

export const routes = new Hono()

// Initialize global EventEmitter for SSE broadcasting
if (!(globalThis as any).speedSSE) {
  (globalThis as any).speedSSE = new EventEmitter()
}

// Helper function to check if user is collaborator
async function isCollaborator(listId: string, userId: string): Promise<boolean> {
  const collaborator = await db.get(
    sql`SELECT 1 FROM collaborators WHERE list_id = ${listId} AND user_id = ${userId}`
  )
  return !!collaborator
}

// Helper function to check read access (duplicated from items.ts)
async function checkReadAccess(listId: string, userId: string | undefined, collabToken: string | null): Promise<boolean> {
  // Get the list
  const list = await db.get(
    sql`SELECT * FROM lists WHERE id = ${listId}`
  )
  
  if (!list) {
    return false
  }
  
  // Check if user is owner or collaborator
  if (userId) {
    if (userId === list.owner_id) {
      return true
    }
    if (await isCollaborator(listId, userId)) {
      return true
    }
  }
  
  // Check token access
  if (collabToken) {
    if (collabToken === list.view_token || collabToken === list.edit_token) {
      return true
    }
  }
  
  return false
}

// GET /sse/lists/:listId/events - Server-Sent Events endpoint for real-time updates
routes.get('/sse/lists/:listId/events', zValidator('param', z.object({
  listId: z.string().uuid()
})), zValidator('query', z.object({
  token: z.string().uuid().optional()
})), async ctx => {
  const {listId} = ctx.req.valid('param')
  const {token} = ctx.req.valid('query')
  const userId = ctx.var.userId
  const collabToken = ctx.req.header('x-collab-token') || token || null
  
  // Check read access
  if (!await checkReadAccess(listId, userId, collabToken)) {
    throw new HTTPException(403, {message: 'Not authorized to view this list'})
  }
  
  // Verify the list exists
  const list = await db.get(
    sql`SELECT 1 FROM lists WHERE id = ${listId}`
  )
  
  if (!list) {
    throw new HTTPException(404, {message: 'List not found'})
  }
  
  // Set SSE headers
  ctx.header('Content-Type', 'text/event-stream')
  ctx.header('Cache-Control', 'no-cache')
  ctx.header('Connection', 'keep-alive')
  
  // Log client connection
  console.log('[SSE] Client connected to list:', listId)
  
  // Create the SSE stream
  return streamSSE(ctx, async (stream: SSEStreamingApi) => {
    // Event listener for this specific list
    const eventHandler = (data: any) => {
      try {
        console.log(`[SSE] Sending update for list ${listId}:`, data.type || 'unknown')
        stream.writeSSE({
          data: JSON.stringify(data),
          event: 'update'
        })
      } catch (err) {
        // Client disconnected or stream closed
        console.error('Error writing SSE data:', err)
      }
    }
    
    // Subscribe to events for this list
    const eventName = `list:${String(listId)}`
    console.log(`[SSE] Adding listener for ${eventName}`)
    // @ts-ignore
    globalThis.speedSSE.on(eventName, eventHandler)
    
    // Log listener count after registration
    // @ts-ignore
    const listenerCount = globalThis.speedSSE.listenerCount(eventName)
    console.log(`[SSE] Listener count for ${eventName}:`, listenerCount)
    
    // Send initial connection message
    stream.writeSSE({
      data: JSON.stringify({ type: 'connected', listId }),
      event: 'system'
    })
    
    // Handle client disconnection
    stream.onAbort(() => {
      // @ts-ignore
      globalThis.speedSSE.off(eventName, eventHandler)
      // @ts-ignore
      const remainingListeners = globalThis.speedSSE.listenerCount(eventName)
      console.log(`[SSE] Removing listener for ${eventName}, connection closed for list ${String(listId)}, remaining listeners: ${remainingListeners}`)
    })
    
    // Keep the connection open
    // The stream will automatically close when the client disconnects
    // due to the onAbort handler above
    await new Promise(() => {
      // This promise never resolves, keeping the connection open
      // until the client disconnects
    })
  })
})
