import {db} from 'speed-framework'
import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import sql from 'sql-template-strings'

export const routes = new Hono()

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

// POST /votes/items/:itemId/vote - Toggle vote on an item
routes.post('/votes/items/:itemId/vote', zValidator('param', z.object({
  itemId: z.string().uuid()
})), async ctx => {
  console.log('[VOTE] ===== VOTE ENDPOINT CALLED =====')
  const {itemId} = ctx.req.valid('param')
  console.log('[VOTE] itemId:', itemId)
  const userId = ctx.var.userId
  console.log('[VOTE] userId:', userId)
  const collabToken = ctx.req.header('x-collab-token') || null
  const anonymousId = ctx.req.header('x-anonymous-id') || null
  console.log('[VOTE] anonymousId:', anonymousId)
  
  // 1. Fetch Context: Get the item with list details
  const itemWithList = await db.get(
    sql`
      SELECT 
        i.*,
        l.id as list_id,
        l.owner_id,
        l.voting_policy,
        l.view_token,
        l.edit_token
      FROM items i
      JOIN lists l ON i.list_id = l.id
      WHERE i.id = ${itemId}
    `
  )
  
  if (!itemWithList) {
    throw new HTTPException(404, {message: 'Item not found'})
  }
  
  const { list_id, owner_id, voting_policy, view_token, edit_token } = itemWithList
  
  // 2. Check Read Access
  if (!await checkReadAccess(list_id, userId, collabToken)) {
    throw new HTTPException(403, {message: 'Not authorized to vote on this item'})
  }
  
  // 3. Check Voting Policy & Identity
  if (voting_policy === 'restricted') {
    // Must have authenticated user
    if (!userId) {
      throw new HTTPException(401, {message: 'Voting requires authentication for this list'})
    }
  } else if (voting_policy === 'open') {
    // Must have either authenticated user OR anonymous ID
    // Check if anonymousId is not null and not empty string
    const hasAnonymousId = anonymousId && anonymousId.trim() !== ''
    if (!userId && !hasAnonymousId) {
      throw new HTTPException(400, {message: 'Either authenticated user or anonymous ID is required to vote'})
    }
  } else {
    // Unknown voting policy
    throw new HTTPException(500, {message: `Unknown voting policy: ${voting_policy}`})
  }
  
  // 4. Toggle Vote
  let voteExists = false
  let voted = false
  
  try {
    // Determine voter key
    if (userId) {
      // Check if vote exists for authenticated user
      const existingVote = await db.get(
        sql`SELECT 1 FROM votes WHERE item_id = ${itemId} AND voter_id = ${userId}`
      )
      
      if (existingVote) {
        // Delete the vote
        await db.run(
          sql`DELETE FROM votes WHERE item_id = ${itemId} AND voter_id = ${userId}`
        )
        voteExists = true
        voted = false
      } else {
        // Insert new vote
        await db.run(
          sql`INSERT INTO votes (item_id, voter_id, anonymous_hash) VALUES (${itemId}, ${userId}, NULL)`
        )
        voteExists = false
        voted = true
      }
    } else {
      // Anonymous user (anonymousId must exist due to policy check)
      const hasAnonymousId = anonymousId && anonymousId.trim() !== ''
      if (!hasAnonymousId) {
        throw new HTTPException(400, {message: 'Anonymous ID is required for anonymous voting'})
      }
      
      const existingVote = await db.get(
        sql`SELECT 1 FROM votes WHERE item_id = ${itemId} AND anonymous_hash = ${anonymousId}`
      )
      
      if (existingVote) {
        // Delete the vote
        await db.run(
          sql`DELETE FROM votes WHERE item_id = ${itemId} AND anonymous_hash = ${anonymousId}`
        )
        voteExists = true
        voted = false
      } else {
        // Insert new vote
        await db.run(
          sql`INSERT INTO votes (item_id, voter_id, anonymous_hash) VALUES (${itemId}, NULL, ${anonymousId})`
        )
        voteExists = false
        voted = true
      }
    }
    
    // Get the full item details with updated vote count
    const itemWithVotes = await db.get(
      sql`
        SELECT 
          i.*,
          COUNT(v.item_id) as vote_count
        FROM items i
        LEFT JOIN votes v ON i.id = v.item_id
        WHERE i.id = ${itemId}
        GROUP BY i.id
      `
    )
    
    console.log('[VOTE] About to broadcast for list_id:', list_id)
    console.log('[VOTE] itemWithVotes:', itemWithVotes)
    
    // Add has_voted as false (server doesn't know user's vote status)
    const fullItemData = {
      ...itemWithVotes,
      vote_count: Number(itemWithVotes.vote_count),
      has_voted: false
    }
    
    console.log('[VOTE] Calling broadcast now...')
    // Broadcast the vote update event with full item details
    // @ts-ignore
    globalThis.speedSSE?.emit(`list:${list_id}`, { type: 'vote.updated', data: fullItemData })
    console.log('[VOTE] Broadcast called successfully')
    
    return ctx.json({ voted })
  } catch (err) {
    // Handle unique constraint violations
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      // This shouldn't happen with our check-then-act logic, but handle it gracefully
      throw new HTTPException(409, {
        message: 'Vote already exists or conflict occurred',
        cause: err
      })
    }
    
    throw new HTTPException(500, {
      message: 'Failed to toggle vote',
      cause: err
    })
  }
})
