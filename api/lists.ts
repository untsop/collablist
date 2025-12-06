import {db} from 'speed-framework'
import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import sql from 'sql-template-strings'
import {broadcast} from './sse'

export const routes = new Hono()

// Helper function to check if user is collaborator
async function isCollaborator(listId: string, userId: string): Promise<boolean> {
  const collaborator = await db.get(
    sql`SELECT 1 FROM collaborators WHERE list_id = ${listId} AND user_id = ${userId}`
  )
  return !!collaborator
}

// Helper function to get list with role
async function getListWithRole(token: string, userId?: string) {
  // Find list by either view_token or edit_token
  const list = await db.get(
    sql`SELECT * FROM lists WHERE view_token = ${token} OR edit_token = ${token}`
  )
  
  if (!list) {
    return null
  }
  
  let role: 'owner' | 'collaborator' | 'editor' | 'viewer' = 'viewer'
  
  // Determine role
  if (userId) {
    if (userId === list.owner_id) {
      role = 'owner'
    } else if (await isCollaborator(list.id, userId)) {
      role = 'collaborator'
    } else if (list.edit_token === token) {
      role = 'editor'
    } else if (list.view_token === token) {
      role = 'viewer'
    }
  } else {
    // No authenticated user
    if (list.edit_token === token) {
      role = 'editor'
    } else {
      role = 'viewer'
    }
  }
  
  // Prepare response - hide edit_token if user doesn't have edit permissions
  const responseList = {
    ...list,
    edit_token: (role === 'owner' || role === 'collaborator' || role === 'editor') ? list.edit_token : undefined
  }
  
  return { list: responseList, role }
}

// 1. GET /lists - Get all lists for current user
routes.get('/lists', async ctx => {
  const userId = ctx.var.userId
  
  if (!userId) {
    throw new HTTPException(401, {message: 'Unauthorized'})
  }
  
  // Get lists where user is owner or collaborator
  const lists = await db.all(
    sql`
      SELECT l.* FROM lists l
      LEFT JOIN collaborators c ON l.id = c.list_id
      WHERE l.owner_id = ${userId} OR c.user_id = ${userId}
      GROUP BY l.id
      ORDER BY l.updated_at DESC
    `
  )
  
  return ctx.json(lists)
})

// 2. POST /lists - Create a new list
routes.post('/lists', zValidator('json', z.object({
  title: z.string().min(1).max(255)
})), async ctx => {
  const userId = ctx.var.userId
  
  if (!userId) {
    throw new HTTPException(401, {message: 'Unauthorized'})
  }
  
  const {title} = ctx.req.valid('json')
  
  const id = crypto.randomUUID()
  const view_token = crypto.randomUUID()
  const edit_token = crypto.randomUUID()
  
  try {
    await db.run(
      sql`
        INSERT INTO lists (id, title, owner_id, view_token, edit_token)
        VALUES (${id}, ${title}, ${userId}, ${view_token}, ${edit_token})
      `
    )
    
    const list = await db.get(
      sql`SELECT * FROM lists WHERE id = ${id}`
    )
    
    return ctx.json(list)
  } catch (err) {
    throw new HTTPException(500, {
      message: 'Failed to create list',
      cause: err
    })
  }
})

// 3. GET /lists/:token - Get list by token with role determination
routes.get('/lists/:token', zValidator('param', z.object({
  token: z.string().uuid()
})), async ctx => {
  const {token} = ctx.req.valid('param')
  const userId = ctx.var.userId
  
  const result = await getListWithRole(token, userId)
  
  if (!result) {
    throw new HTTPException(404, {message: 'List not found'})
  }
  
  return ctx.json(result)
})

// 4. PUT /lists/:id - Update list settings
routes.put('/lists/:id', zValidator('param', z.object({
  id: z.string().uuid()
})), zValidator('json', z.object({
  title: z.string().min(1).max(255).optional(),
  sorting_mode: z.enum(['updated', 'created', 'manual', 'vote']).optional(),
  voting_policy: z.enum(['open', 'restricted']).optional()
})), async ctx => {
  const {id} = ctx.req.valid('param')
  const updates = ctx.req.valid('json')
  const userId = ctx.var.userId
  
  // Get the list first
  const list = await db.get(
    sql`SELECT * FROM lists WHERE id = ${id}`
  )
  
  if (!list) {
    throw new HTTPException(404, {message: 'List not found'})
  }
  
  // Check authorization
  let isAuthorized = false
  
  // Check if user is owner or collaborator
  if (userId) {
    if (userId === list.owner_id) {
      isAuthorized = true
    } else if (await isCollaborator(id, userId)) {
      isAuthorized = true
    }
  }
  
  // Check edit token from header
  const editToken = ctx.req.header('x-collab-token')
  if (editToken && editToken === list.edit_token) {
    isAuthorized = true
  }
  
  if (!isAuthorized) {
    throw new HTTPException(403, {message: 'Not authorized to update this list'})
  }
  
  // Build update query using sql-template-strings
  const updateParts: string[] = []
  const values: any[] = []
  
  if (updates.title !== undefined) {
    updateParts.push('title = ?')
    values.push(updates.title)
  }
  
  if (updates.sorting_mode !== undefined) {
    updateParts.push('sorting_mode = ?')
    values.push(updates.sorting_mode)
  }
  
  if (updates.voting_policy !== undefined) {
    updateParts.push('voting_policy = ?')
    values.push(updates.voting_policy)
  }
  
  // Always update updated_at
  updateParts.push('updated_at = CURRENT_TIMESTAMP')
  
  if (updateParts.length > 0) {
    // Build the SQL query manually since we have dynamic fields
    const query = `UPDATE lists SET ${updateParts.join(', ')} WHERE id = ?`
    values.push(id)
    
    await db.run(query, values)
  }
  
  // Fetch updated list
  const updatedList = await db.get(
    sql`SELECT * FROM lists WHERE id = ${id}`
  )
  
  // Broadcast the list update event
  broadcast(id, { type: 'list.updated', data: updatedList })
  
  return ctx.json(updatedList)
})

// 5. POST /lists/:id/fork - Fork a list
routes.post('/lists/:id/fork', zValidator('param', z.object({
  id: z.string().uuid()
})), async ctx => {
  const {id} = ctx.req.valid('param')
  const userId = ctx.var.userId
  
  if (!userId) {
    throw new HTTPException(401, {message: 'Unauthorized'})
  }
  
  // Get source list
  const sourceList = await db.get(
    sql`SELECT * FROM lists WHERE id = ${id}`
  )
  
  if (!sourceList) {
    throw new HTTPException(404, {message: 'List not found'})
  }
  
  // Create new list
  const newId = crypto.randomUUID()
  const view_token = crypto.randomUUID()
  const edit_token = crypto.randomUUID()
  
  try {
    await db.run(
      sql`
        INSERT INTO lists (id, title, owner_id, view_token, edit_token, sorting_mode, voting_policy)
        VALUES (${newId}, ${sourceList.title}, ${userId}, ${view_token}, ${edit_token}, ${sourceList.sorting_mode}, ${sourceList.voting_policy})
      `
    )
    
    // Copy items from source list
    const sourceItems = await db.all(
      sql`SELECT * FROM items WHERE list_id = ${id}`
    )
    
    for (const item of sourceItems) {
      const newItemId = crypto.randomUUID()
      await db.run(
        sql`
          INSERT INTO items (id, list_id, text, note, position, is_completed)
          VALUES (${newItemId}, ${newId}, ${item.text}, ${item.note}, ${item.position}, 0)
        `
      )
    }
    
    // Fetch the new list
    const newList = await db.get(
      sql`SELECT * FROM lists WHERE id = ${newId}`
    )
    
    return ctx.json(newList)
  } catch (err) {
    throw new HTTPException(500, {
      message: 'Failed to fork list',
      cause: err
    })
  }
})

// 6. POST /lists/:id/collaborators - Add collaborator
routes.post('/lists/:id/collaborators', zValidator('param', z.object({
  id: z.string().uuid()
})), zValidator('json', z.object({
  userId: z.string().uuid()
})), async ctx => {
  const {id} = ctx.req.valid('param')
  const {userId: collaboratorId} = ctx.req.valid('json')
  const currentUserId = ctx.var.userId
  
  if (!currentUserId) {
    throw new HTTPException(401, {message: 'Unauthorized'})
  }
  
  // Check if current user is owner
  const list = await db.get(
    sql`SELECT * FROM lists WHERE id = ${id}`
  )
  
  if (!list) {
    throw new HTTPException(404, {message: 'List not found'})
  }
  
  if (list.owner_id !== currentUserId) {
    throw new HTTPException(403, {message: 'Only the list owner can add collaborators'})
  }
  
  // Check if collaborator exists as a user
  const user = await db.get(
    sql`SELECT 1 FROM users WHERE id = ${collaboratorId}`
  )
  
  if (!user) {
    throw new HTTPException(404, {message: 'User not found'})
  }
  
  // Check if already a collaborator
  const existingCollaborator = await db.get(
    sql`SELECT 1 FROM collaborators WHERE list_id = ${id} AND user_id = ${collaboratorId}`
  )
  
  if (existingCollaborator) {
    throw new HTTPException(409, {message: 'User is already a collaborator'})
  }
  
  try {
    await db.run(
      sql`INSERT INTO collaborators (list_id, user_id) VALUES (${id}, ${collaboratorId})`
    )
    
    return ctx.json({ success: true })
  } catch (err) {
    throw new HTTPException(500, {
      message: 'Failed to add collaborator',
      cause: err
    })
  }
})
