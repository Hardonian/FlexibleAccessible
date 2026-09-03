import { defineConfig } from '@prisma/config'

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://aros:aros@localhost:5432/aros_dev',
  },
})
