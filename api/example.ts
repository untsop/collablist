import {db} from 'speed-framework'
import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import {z} from 'zod'
import {zValidator} from '@hono/zod-validator'
import sql from 'sql-template-strings'

export const routes = new Hono()

// GET /api/example/books - Return a list of books by the author specified in query string
routes.get('/example/books', zValidator('query', z.object({
  author: z.string()
})), async ctx => {
  const {author} = ctx.req.valid('query')

  const books = await db.all(sql`SELECT * FROM books WHERE author = ${author}`)

  return ctx.json(books)
})

// POST /api/example/books - Insert a new book to the database
routes.post('/example/books', zValidator('json', z.object({
  name: z.string(),
  author: z.string()
})), async ctx => {
  const {name, author} = ctx.req.valid('json')

  const {lastID} = await db.run(sql`INSERT INTO books (name, author) VALUES (${name}, ${author})`)

  const book = await db.get(sql`SELECT * FROM books WHERE id = ${lastID}`)

  return ctx.json(book)
})

// POST /api/example/big-add - Add two numbers and return the result
routes.post('/example/big-add', zValidator('json', z.object({
  a: z.string(),
  b: z.string()
})), async ctx => {
  const {a, b} = ctx.req.valid('json')

  try {
    return ctx.json({
      result: (BigInt(a) + BigInt(b)).toString()
    })
  } catch (err) {
    throw new HTTPException(400, {message: 'Parse BigInt failed', cause: err})
  }
})

// GET /api/example/user - Verify the user's authentication and return the unique ID
routes.get('/example/user', async ctx => {
  if (!ctx.var.userId) {
    throw new HTTPException(401, {message: 'Unauthorized'})
  }

  return ctx.json({
    userId: ctx.var.userId
  })
})
