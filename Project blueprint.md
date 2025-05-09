# Graphify: Project Blueprint

Welcome to the Graphify project blueprint! This document outlines the vision, technology, features, and development plan for building a platform that lets anyone design and automate beautiful GitHub contribution graphs.

---

## 🌟 Vision
Graphify empowers users to create, preview, and apply custom patterns to their GitHub contribution graphs—securely, authentically, and with ease. Whether you’re a developer, designer, or hobbyist, Graphify gives you the tools to make your profile stand out.

---

## 🏗️ Technology Stack
| Component      | Technology/Package         | Why?                                      |
|---------------|---------------------------|--------------------------------------------|
| Runtime & PM  | Bun                       | Ultra-fast JS/TS runtime & package manager |
| Frontend UI   | Angular + Material        | Modular, accessible, scalable UI           |
| Backend API   | NestJS                    | TypeScript-first, modular backend          |
| Database      | PostgreSQL                | Reliable, scalable relational DB           |
| ORM           | Prisma                    | Type-safe, developer-friendly ORM          |
| Auth          | GitHub OAuth (@octokit)   | Secure, robust OAuth                       |
| API           | GraphQL (Apollo)          | Flexible, efficient API layer              |
| Git Automation| simple-git, isomorphic-git| Reliable, cross-platform Git automation    |
| Dates         | Luxon, rrule, chrono-node | Advanced date/time, recurrence, NLP        |
| CLI           | oclif, enquirer           | Best-in-class CLI & prompts                |
| Testing       | Jest, Cypress             | Comprehensive testing                      |
| Deployment    | Docker, GitHub Actions    | Containerization & CI/CD                   |
| Hosting       | Vercel, DigitalOcean      | Fast, scalable hosting                     |
| Monitoring    | Prometheus, Grafana       | Real-time metrics & visualization          |
| Logging       | Pino                      | High-performance, structured logging       |

---

## ✨ Core Features
- **Visual Pattern Designer:** Drag-and-drop grid, color picker, import/export (JSON, SVG, CSV), template gallery
- **Pattern-to-Commit Mapping:** Converts designs into optimized commit schedules
- **Commit Authenticity:** Adaptive algorithms for realistic, undetectable activity
- **Advanced Scheduling:** Recurrence rules, randomization, time zone support
- **GitHub Integration:** OAuth2 login, repo management, automated commits
- **Flexible Interaction:** Web dashboard, full-featured CLI, public GraphQL API
- **Security:** RBAC, encrypted tokens, rate limiting, audit logging
- **Extensibility:** Pattern marketplace, undo/redo, multi-repo/user support, notifications, accessibility

---

## 🛠️ Development Workflow
1. **Foundation:**
   - Bootstrap Bun monorepo
   - Initialize Angular app (Material, NgRx)
   - Set up NestJS backend (GraphQL, Prisma)
   - Configure PostgreSQL & Prisma schema
   - Implement GitHub OAuth (web & CLI)
2. **Backend Engineering:**
   - Design DB schema
   - Build core services (pattern mapping, scheduling, authenticity)
   - Integrate GitHub API
   - Implement GraphQL API
   - Add background workers
3. **Frontend Engineering:**
   - Build pattern designer
   - Develop dashboard (scheduling, preview, logs)
   - Integrate with backend API
   - Implement authentication & responsive design
4. **CLI Tool:**
   - Scaffold with oclif
   - Add interactive pattern input, import/export
   - Integrate OAuth device flow
   - Implement commit scheduling/execution
   - Support config files & batch mode
5. **Testing, Security, Deployment:**
   - Write comprehensive tests
   - Set up CI/CD (GitHub Actions, Docker)
   - Deploy (Vercel, DigitalOcean)
   - Set up monitoring/logging
   - Conduct security audits

---

## 🧑‍💻 User Journey
**Web App:**
1. Login with GitHub OAuth
2. Design/import a pattern
3. Preview your graph
4. Customize schedule/messages
5. Select target repo(s)
6. Execute & monitor
7. View logs, undo/redo, or share

**CLI:**
1. Authenticate via OAuth device flow
2. Import/create pattern (ASCII/JSON)
3. Preview in terminal
4. Set schedule & repo
5. Execute & monitor
6. View logs or rollback

---

## 🏛️ Architecture
```
+------------+       +------------+       +------------+
| Frontend   | <---->|  Backend   | <---->|  Database  |
| (Angular)  |       | (NestJS)   |       | (Prisma)   |
+------------+       +------------+       +------------+
      |                      ^
      v                      |
+------------+               |
|    CLI     | ---------------
| (TS)       |
+------------+
```

---

## 📚 API Endpoints (Sample)
- **POST /auth/github**: Start GitHub OAuth
- **GET /auth/callback**: Handle OAuth callback
- **GET /patterns**: List patterns
- **POST /patterns**: Save new pattern
- **PUT /patterns/:id**: Update pattern
- **DELETE /patterns/:id**: Delete pattern
- **POST /commits**: Generate backdated commits

---

## 🗄️ Database Schema (Prisma)
- **Users:** GitHub info & tokens
- **Patterns:** Contribution graph patterns
- **Commits:** Commit logs

---

## 🌀 Supported Pattern Types
1. **Linear:** Evenly distributed commits
2. **Custom:** User-defined dates/counts
3. **Randomized:** Random commit distribution

---

## 🚧 Future Enhancements
- More complex patterns (spirals, waves)
- GitHub Actions integration
- Real-time collaboration

---

## 🤝 Contribution Guidelines
See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get involved!

