# GitHub Actions CI/CD Pipeline Demo

A small Node.js todo microservice used to show a production-style pipeline: a **reusable workflow** for lint, test and Docker build/push, and **blue-green deployment** to Azure Web Apps using deployment slots.

## Pipeline

```
pull request ─▶ lint ─┐
                      ├─▶ build image (no push)
                test ─┘

push to main ─▶ lint + test ─▶ build & push to Docker Hub (tag: sha-xxxxxxx)
             ─▶ deploy to "staging" slot (green)
             ─▶ smoke test: wait until /version reports the new tag, then /health
             ─▶ swap staging ⇄ production (blue)
             ─▶ verify production is serving the new tag
```

- **Reusable workflow** (`.github/workflows/reusable-node-build.yml`) is called with `workflow_call`, so any Node service can use the same lint/test/build stages.
- **Zero-downtime release:** Azure warms the staging slot before the swap and routes traffic over only when it's healthy.
- **Instant rollback:** the previous version is left in the staging slot. Run the *Rollback production* workflow to swap back.
- **No stored Azure passwords:** GitHub logs in to Azure with OIDC federated credentials.
- **Immutable image tags:** every build is tagged with the commit SHA, and `/version` reports it, so you can see exactly what's live.

## Run locally

```bash
npm install
npm run lint
npm test
npm start            # http://localhost:8080/health
```

or with Docker:

```bash
docker build -t todo-service .
docker run -p 8080:8080 todo-service
```

## API

| Method | Path | |
|---|---|---|
| GET | `/health` | status, version, uptime |
| GET | `/version` | deployed tag and slot name |
| GET | `/api/todos` | list |
| POST | `/api/todos` | `{ "title": "..." }` |
| PATCH | `/api/todos/:id` | `{ "done": true }` |
| DELETE | `/api/todos/:id` | |

## Deploy to Azure

1. Log in with `az login`, then run `./infra/setup-azure.sh <your-github-user>/node-ci-cd-example`. This creates the resource group, an S1 App Service plan, a web app with a `staging` slot, and OIDC credentials for GitHub.
2. Add the secrets and variables the script prints to the GitHub repo.
3. Create `staging` and `production` environments in the repo settings. Add required reviewers to `production` if you want a manual approval before the swap.
4. Push to `main`.

> Deployment slots need an S1 (Standard) plan or higher, which is billed hourly. Delete the resource group when you're done: `az group delete -n rg-todo-service`.
