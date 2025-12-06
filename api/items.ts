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

// Helper function to check read access
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

// Helper function to check write access
async function checkWriteAccess(listId: string, userId: string | undefined, collabToken: string | null): Promise<boolean> {
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
  
  // Check token access - only edit_token grants write access
  if (collabToken && collabToken === list.edit_token) {
    return true
  }
  
  return false
}

// Helper function to get list sorting SQL
function getSortingSql(sortingMode: string): string {
  switch (sortingMode) {
    case 'updated':
      return 'i.updated_at DESC'
    case 'created':
      return 'i.created_at ASC'
    case 'manual':
      return 'i.position ASC'
    case 'vote':
      return 'vote_count DESC'
    default:
      return 'i.updated_at DESC'
  }
}

// 1. GET /items/lists/:listId/items - Get items for a list
routes.get('/items/lists/:listId/items', zValidator('param', z.object({
  listId: z.string().uuid()
})), async ctx => {
  const {listId} = ctx.req.valid('param')
  const userId = ctx.var.userId
  const collabToken = ctx.req.header('x-collab-token') || null
  const anonymousId = ctx.req.header('x-anonymous-id') || null
  
  // Check read access
  if (!await checkReadAccess(listId, userId, collabToken)) {
    throw new HTTPException(403, {message: 'Not authorized to view this list'})
  }
  
  // Get list to determine sorting mode
  const list = await db.get(
    sql`SELECT sorting_mode FROM lists WHERE id = ${listId}`
  )
  
  if (!list) {
    throw new HTTPException(404, {message: 'List not found'})
  }
  
  // Build the query to get items with vote counts and has_voted status
  // We need to handle both authenticated users (userId) and anonymous users (anonymousId)
  // We'll use a parameterized approach to avoid SQL injection
  const sortingSql = getSortingSql(list.sorting_mode)
  
  // Use a single query with LEFT JOIN and GROUP BY
  // We'll use a subquery to check if the current user has voted
  let items
  if (userId) {
    // Authenticated user
    items = await db.all(
      sql`
        SELECT 
          i.*,
          COUNT(v.item_id) as vote_count,
          CASE WHEN EXISTS (
            SELECT 1 FROM votes v2 
            WHERE v2.item_id = i.id AND v2.voter_id = ${userId}
          ) THEN 1 ELSE 0 END as has_voted
        FROM items i
        LEFT JOIN votes v ON i.id = v.item_id
        WHERE i.list_id = ${listId}
        GROUP BY i.id
        ORDER BY ${sortingSql}
      `
    )
  } else if (anonymousId) {
    // Anonymous user with ID
    items = await db.all(
      sql`
        SELECT 
          i.*,
          COUNT(v.item_id) as vote_count,
          CASE WHEN EXISTS (
            SELECT 1 FROM votes v2 
            WHERE v2.item_id = i.id AND v2.anonymous_hash = ${anonymousId}
          ) THEN 1 ELSE 0 END as has_voted
        FROM items i
        LEFT JOIN votes v ON i.id = v.item_id
        WHERE i.list_id = ${listId}
        GROUP BY i.id
        ORDER BY ${sortingSql}
      `
    )
  } else {
    // No user ID or anonymous ID
    items = await db.all(
      sql`
        SELECT 
          i.*,
          COUNT(v.item_id) as vote_count,
          0 as has_voted
        FROM items i
        LEFT JOIN votes v ON i.id = v.item_id
        WHERE i.list_id = ${listId}
        GROUP BY i.id
        ORDER BY ${sortingSql}
      `
    )
  }
  
  // Convert has_voted from 0/1 to boolean
  const itemsWithVotes = items.map(item => ({
    ...item,
    vote_count: Number(item.vote_count),
    has_voted: Boolean(item.has_voted)
  }))
  
  return ctx.json({ items: itemsWithVotes })
})

// 2. POST /items/lists/:listId/items - Create a new item
routes.post('/items/lists/:listId/items', zValidator('param', z.object({
  listId: z.string().uuid()
})), zValidator('json', z.object({
  text: z.string().min(1),
  note: z.string().optional()
})), async ctx => {
  const {listId} = ctx.req.valid('param')
  const {text, note} = ctx.req.valid('json')
  const userId = ctx.var.userId
  const collabToken = ctx.req.header('x-collab-token') || null
  
  // Check write access
  if (!await checkWriteAccess(listId, userId, collabToken)) {
    throw new HTTPException(403, {message: 'Not authorized to add items to this list'})
  }
  
  // Calculate position (max(position) + 1 or 0 if empty)
  const maxPositionResult = await db.get(
    sql`SELECT MAX(position) as max_position FROM items WHERE list_id = ${listId}`
  )
  
  const position = maxPositionResult?.max_position !== null ? maxPositionResult.max_position + 1 : 0
  
  const id = crypto.randomUUID()
  
  try {
    await db.run(
      sql`
        INSERT INTO items (id, list_id, text, note, position)
        VALUES (${id}, ${listId}, ${text}, ${note || null}, ${position})
      `
    )
    
    // Fetch the created item with vote_count (0 for new items)
    const item = await db.get(
      sql`
        SELECT 
          i.*,
          0 as vote_count,
          0 as has_voted
        FROM items i
        WHERE i.id = ${id}
      `
    )
    
    // Broadcast the creation event with full item details
    // @ts-ignore
    globalThis.speedSSE?.emit(`list:${listId}`, { type: 'item.created', data: item })
    
    return ctx.json(item)
  } catch (err) {
    throw new HTTPException(500, {
      message: 'Failed to create item',
      cause: err
    })
  }
})

// 3. PUT /items/:id - Update an item
routes.put('/items/:id', zValidator('param', z.object({
  id: z.string().uuid()
})), zValidator('json', z.object({
  text: z.string().min(1).optional(),
  note: z.string().optional(),
  is_completed: z.boolean().optional()
})), async ctx => {
  const {id} = ctx.req.valid('param')
  const updates = ctx.req.valid('json')
  
  // First, get the item to find its list
  const item = await db.get(
    sql`SELECT * FROM items WHERE id = ${id}`
  )
  
  if (!item) {
    throw new HTTPException(404, {message: 'Item not found'})
  }
  
  const userId = ctx.var.userId
  const collabToken = ctx.req.header('x-collab-token') || null
  
  // Check write access for the list
  if (!await checkWriteAccess(item.list_id, userId, collabToken)) {
    throw new HTTPException(403, {message: 'Not authorized to update this item'})
  }
  
  // Build update query
  const updateParts: string[] = []
  const values: any[] = []
  
  if (updates.text !== undefined) {
    updateParts.push('text = ?')
    values.push(updates.text)
  }
  
  if (updates.note !== undefined) {
    updateParts.push('note = ?')
    values.push(updates.note || null)
  }
  
  if (updates.is_completed !== undefined) {
    updateParts.push('is_completed = ?')
    values.push(updates.is_completed ? 1 : 0)
  }
  
  // Always update updated_at
  updateParts.push('updated_at = CURRENT_TIMESTAMP')
  
  if (updateParts.length > 0) {
    // Build the SQL query manually since we have dynamic fields
    const query = `UPDATE items SET ${updateParts.join(', ')} WHERE id = ?`
    values.push(id)
    
    await db.run(query, values)
  }
  
  // Fetch updated item with vote_count
  const updatedItem = await db.get(
    sql`
      SELECT 
        i.*,
        COUNT(v.item_id) as vote_count
      FROM items i
      LEFT JOIN votes v ON i.id = v.item_id
      WHERE i.id = ${id}
      GROUP BY i.id
    `
  )
  
  // Add has_voted as false (server doesn't know user's vote status)
  const itemWithVotes = {
    ...updatedItem,
    vote_count: Number(updatedItem.vote_count),
    has_voted: false
  }
  
  // Broadcast the update event with full item details
  // @ts-ignore
  globalThis.speedSSE?.emit(`list:${item.list_id}`, { type: 'item.updated', data: itemWithVotes })
  
  return ctx.json(itemWithVotes)
})

// 4. DELETE /items/:id - Delete an item
routes.delete('/items/:id', zValidator('param', z.object({
  id: z.string().uuid()
})), async ctx => {
  const {id} = ctx.req.valid('param')
  
  // First, get the item to find its list
  const item = await db.get(
    sql`SELECT * FROM items WHERE id = ${id}`
  )
  
  if (!item) {
    throw new HTTPException(404, {message: 'Item not found'})
  }
  
  const userId = ctx.var.userId
  const collabToken = ctx.req.header('x-collab-token') || null
  
  // Check write access for the list
  if (!await checkWriteAccess(item.list_id, userId, collabToken)) {
    throw new HTTPException(403, {message: 'Not authorized to delete this item'})
  }
  
  try {
    await db.run(
      sql`DELETE FROM items WHERE id = ${id}`
    )
    
    // Broadcast the deletion event with only the ID
    // @ts-ignore
    globalThis.speedSSE?.emit(`list:${item.list_id}`, { 
      type: 'item.deleted', 
      id: id
    })
    
    return ctx.json({ success: true })
  } catch (err) {
    throw new HTTPException(500, {
      message: 'Failed to delete item',
      cause: err
    })
  }
})

// 5. PUT /items/lists/:listId/reorder - Reorder items in a list
routes.put('/items/lists/:listId/reorder', zValidator('param', z.object({
  listId: z.string().uuid()
})), zValidator('json', z.object({
  itemIds: z.array(z.string().uuid())
})), async ctx => {
  const {listId} = ctx.req.valid('param')
  const {itemIds} = ctx.req.valid('json')
  const userId = ctx.var.userId
  const collabToken = ctx.req.header('x-collab-token') || null
  
  // Check write access
  if (!await checkWriteAccess(listId, userId, collabToken)) {
    throw new HTTPException(403, {message: 'Not authorized to reorder items in this list'})
  }
  
  // Ensure all items belong to the list
  // We need to build the query dynamically since we have a variable number of itemIds
  // First, check if there are any items
  if (itemIds.length === 0) {
    return ctx.json({ success: true })
  }
  
  // Build the IN clause with placeholders
  const placeholders = itemIds.map(() => '?').join(',')
  const itemsInList = await db.all(
    `SELECT id FROM items WHERE list_id = ? AND id IN (${placeholders})`,
    [listId, ...itemIds]
  )
  
  if (itemsInList.length !== itemIds.length) {
    throw new HTTPException(400, {message: 'Some items do not belong to this list'})
  }
  
  // Update positions in a transaction
  try {
    await db.run('BEGIN TRANSACTION')
    
    for (let i = 0; i < itemIds.length; i++) {
      const itemId = itemIds[i]
      await db.run(
        sql`UPDATE items SET position = ${i}, updated_at = CURRENT_TIMESTAMP WHERE id = ${itemId}`
      )
    }
    
    await db.run('COMMIT')
    
    // Broadcast the reorder event
    // @ts-ignore
    globalThis.speedSSE?.emit(`list:${listId}`, { type: 'items.reordered', itemIds: itemIds })
    
    return ctx.json({ success: true })
  } catch (err) {
    await db.run('ROLLBACK')
    throw new HTTPException(500, {
      message: 'Failed to reorder items',
      cause: err
    })
  }
})
