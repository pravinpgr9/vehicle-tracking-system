# Backend

NestJS + Prisma/PostgreSQL API and WebSocket gateway for the Vehicle Tracking & Telematics Platform.

- Setup, seeding, GPS simulator, tests: [DEVELOPMENT.md](DEVELOPMENT.md)
- Full API reference with `curl` examples: [../API.md](../API.md)
- Design decisions: [../ARCHITECTURE.md](../ARCHITECTURE.md)

Quick start:

```bash
npm install
cp .env.example .env   # set DATABASE_URL, JWT_SECRET
npx prisma migrate dev
npm run seed
npm run start:dev
```

Swagger UI: `http://localhost:3000/api/docs`.
