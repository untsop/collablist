import {db} from 'speed-framework'
import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import sql from 'sql-template-strings'

export const routes = new Hono()

// PUT /api/users/me - Update or insert user profile
routes.put('/me', zValidator('json', z.object({
  name: z.string().min(1).max(100)
})), async ctx => {
  const userId = ctx.var.userId
  
  if (!userId) {
    throw new HTTPException(401, {message: 'Unauthorized'})
  }
  
  const {name} = ctx.req.valid('json')
  
  try {
    // Try to update existing user
    const result = await db.run(
      sql`UPDATE users SET name = ${name} WHERE id = ${userId}`
    )
    
    // If no rows were updated, insert new user
    if (result.changes === 0) {
      await db.run(
        sql`INSERT INTO users (id, name) VALUES (${userId}, ${name})`
      )
    }
    
    // Fetch the user to return
    const user = await db.get(
      sql`SELECT id, name, created_at FROM users WHERE id = ${userId}`
    )
    
    return ctx.json(user)
  } catch (err) {
    throw new HTTPException(500, { 
      message: 'Failed to update user profile', 
      cause: err 
    })
  }
})
