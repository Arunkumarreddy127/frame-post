# Framepost

Full-stack foundation with basic username authentication and a simple homepage.

## Stack

- Frontend: React, TypeScript, Vite
- Backend: Java 21, Spring Boot, Maven
- Data: MongoDB
- Object storage: Cloudflare R2 through the S3-compatible AWS SDK

This workspace intentionally contains no Instagram or publishing features. Authentication is limited to username/password registration, login, logout, and the authenticated homepage greeting.

## Configuration

Copy `.env.example` to `.env` and replace the R2 placeholders when needed. The default local values use MongoDB database `framepost` and R2 bucket `framepost-assets`.

## Run locally

```bash
docker compose up -d mongodb

cd backend
./mvnw spring-boot:run

cd ../frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`. The backend actuator health endpoint is available at `http://localhost:8080/actuator/health`.

Register or log in from the frontend. User records and server-managed sessions are stored in MongoDB. The session cookie is HttpOnly; set `AUTH_COOKIE_SECURE=true` when serving the backend over HTTPS.

## Validate

```bash
cd frontend
npm run lint
npm run build

cd ../backend
./mvnw test
./mvnw package
```
