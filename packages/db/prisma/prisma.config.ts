import { defineConfig } from '@prisma/config'

export default defineConfig({
  engine: "classic",
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://aros:***@localhost:5432/aros_dev',
  },
})
