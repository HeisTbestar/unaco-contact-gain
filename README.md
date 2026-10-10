# UNACO Contact Gain

Needs Node.js 22+ (https://nodejs.org). This is NOT a PHP project: it will not run from XAMPP htdocs by opening index.html.

## Run locally (VS Code terminal, in this folder)
1. `npm install`
2. Terminal 1 (backend, in-memory test data): 
   - Windows PowerShell: `$env:ADMIN_EXPORT_TOKEN="test-token-at-least-24-characters-long"; npm run dev:api`
   - Mac/Linux: `ADMIN_EXPORT_TOKEN=test-token-at-least-24-characters-long npm run dev:api`
3. Terminal 2 (website): `npm run dev` then open the http://localhost:5173 address it prints.
4. Owner export page: http://localhost:5173/#admin (use the same token).
5. Tests: `npm test`. Production build: `npm run build`.

Data in local mode is lost when the backend stops. Deployment: see docs/DEPLOY.md. Handover: docs/HANDOVER.md.
