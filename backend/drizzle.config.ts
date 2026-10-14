import { existsSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')

export default defineConfig({
  dialect: 'sqlite',
  schema: './lib/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_PATH ?? './data/blackjack.db' },
})
