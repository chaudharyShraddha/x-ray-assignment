# X-Ray SDK & API

A debugging and observability system for multi-step, non-deterministic algorithmic processes. X-Ray answers "why did the system make this decision?" rather than just "what happened?"

## Overview

X-Ray provides decision-level visibility into complex pipelines by tracking:
- **Runs**: Pipeline executions
- **Steps**: Decision points within runs
- **Candidates**: Items evaluated at each step
- **Filters**: Constraints applied and their impact

Unlike traditional tracing (Jaeger, Zipkin) that focuses on performance and flow, X-Ray focuses on **decision reasoning**—capturing inputs, candidates, filters, and outcomes at each step.

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- npm or yarn

### Setup

1. **Clone and install dependencies**:
```bash
npm install
```

This installs dependencies for all workspaces (shared package, SDK, and API) automatically.

2. **Configure database**:
Create a `.env` file:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/xray_db
API_PORT=3000
XRAY_API_URL=http://localhost:3000
```

3. **Create database and run migrations**:
```bash
createdb xray_db OR createdb -U postgres xray_db
npm run migrate
```

4. **Start the API server**:
```bash
npm run dev:api
# Or: cd services/api && npm run dev
```

The API will be available at `http://localhost:3000`
- **Health Check**: `http://localhost:3000/health`

### Using the SDK

```typescript
import { XRay, CommonStepTypes } from '@xray/sdk';

// Initialize
const xray = new XRay({
  apiUrl: process.env.XRAY_API_URL || 'http://localhost:3000'
});

// Start a run
const run = await xray.startRun({
  pipelineId: 'competitor-selection',
  input: { product: '...' }
});

// Instrument a step
const step = await xray.startStep({
  stepType: CommonStepTypes.FILTERING,
  input: candidates,
  reasoning: 'Filtering by price range'
});

// Record candidates
await xray.recordCandidates(step.id, candidates, acceptedIds);

// Complete step
await xray.completeStep(step.id, filtered);

// Complete run
await xray.completeRun({ result: bestCompetitor });
```

### Run Example

```bash
# Make sure API server is running first
npm run dev:api

# In another terminal (from project root)
npx ts-node -r tsconfig-paths/register examples/competitor-selection.ts
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed design decisions, data model rationale, and system architecture.

## Approach

### Design Philosophy

1. **General-Purpose**: Not tied to any specific domain—can instrument any multi-step process
2. **Queryable**: Normalized relational model enables complex cross-pipeline queries
3. **Performance-Aware**: Configurable detail level (full capture vs. hybrid vs. summary)
4. **Developer-Friendly**: Minimal code changes required, graceful degradation when backend unavailable

### Key Features

- **Flexible Data Model**: JSONB fields allow extensibility without schema changes
- **Step-Level Tracking**: Candidates tracked per-step to see transformation through pipeline
- **Configurable Detail**: Automatic optimization for large candidate sets (5,000+ candidates)
- **Offline Support**: Pipeline continues normally if X-Ray API is unavailable

### Integration Patterns

**Minimal Instrumentation** (Quick Start):
- Wrap pipeline with `startRun()` / `completeRun()`
- Wrap steps with `startStep()` / `completeStep()`
- Get basic visibility: steps, timing, input/output

**Full Instrumentation** (Complete Visibility):
- Add `recordCandidates()` to track items at each step
- Add `recordFilter()` to track constraints and their impact
- Add `reasoning` text to explain decisions
- Configure `captureAllCandidates` for critical debugging

## API Endpoints

### Ingest
- `POST /api/runs` - Create a new run
- `POST /api/steps` - Create a step
- `POST /api/steps/:stepId/candidates` - Record candidates (bulk)
- `POST /api/steps/:stepId/filters` - Record a filter
- `PATCH /api/runs/:id` - Update a run
- `PATCH /api/steps/:id` - Update a step

### Query
- `GET /api/runs/:id` - Get run with all details (includes steps, candidates, filters)
- `GET /api/runs` - List runs (with optional filters: `pipelineId`, `status`, `limit`, `offset`)
- `GET /api/steps/:id` - Get step with candidates and filters
- `GET /api/steps/:stepId/candidates` - Get candidates for a step (with optional `status` filter)
- `GET /api/steps/query/high-elimination?threshold=0.9` - Find filtering steps that eliminated >90%
- `GET /api/steps/query/by-type/:stepType` - Find all steps of a specific type

### Health
- `GET /health` - Health check endpoint

## Project Structure

```
.
├── packages/
│   └── shared/          # Shared types (used by SDK and API)
│       └── types.ts     # Common interfaces and types
├── services/
│   ├── sdk/             # X-Ray SDK microservice (client library)
│   │   └── src/
│   │       ├── index.ts      # Public API exports
│   │       ├── xray.ts       # Main SDK class
│   │       └── client.ts     # HTTP API client
│   └── api/             # X-Ray API microservice (REST server)
│       └── src/
│           ├── server.ts           # Express server setup
│           ├── routes/             # API route handlers
│           ├── repositories/       # Data access layer (TypeORM)
│           │   └── base/           # Base repository pattern
│           ├── entities/           # TypeORM entity definitions
│           ├── db/                # Database configuration
│           │   ├── data-source.ts # TypeORM DataSource
│           │   └── migrations/    # Database migrations
│           └── config/            # Configuration files
├── examples/
│   └── competitor-selection.ts    # Demo pipeline
├── ARCHITECTURE.md                # Design documentation
└── README.md                      # This file
```

## Known Limitations

1. **No Real-time Streaming**: Currently batch-based—data sent after step completion. Future: WebSocket support for live updates.

2. **Limited Query Language**: Basic REST API. Future: GraphQL for more flexible queries.

3. **Single Language SDK**: Currently TypeScript/Node.js only. Future: Python, Go, Java SDKs.

4. **No Visualization**: API-only, no web UI. Future: Web dashboard for exploring runs.

5. **Candidate Sampling**: For large sets (>1000), only samples are stored. May miss edge cases in rejected candidates.

6. **No Data Retention**: No automatic cleanup. Future: Retention policies and archival.

7. **Basic Error Handling**: API errors are logged but not retried. Future: Retry logic with exponential backoff.

8. **No Access Control**: All runs are accessible. Future: Authentication and authorization.

## Future Improvements

See [ARCHITECTURE.md](./ARCHITECTURE.md#what-next) for detailed roadmap including:
- Real-time streaming
- Advanced querying (GraphQL)
- Performance optimizations
- Visualization UI
- Multi-language SDKs
- Security & privacy features

## Development

```bash
# Install all dependencies (workspaces)
npm install

# Build all services
npm run build

# Build individual services
npm run build:shared  # Must be built first
npm run build:sdk
npm run build:api

# Run API server in dev mode
npm run dev:api

# Run database migrations
npm run migrate

# Run example (requires tsconfig-paths for path resolution)
npx ts-node -r tsconfig-paths/register examples/competitor-selection.ts
```

## Technology Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Database**: PostgreSQL 12+ with TypeORM
- **API Framework**: Express.js
- **Architecture**: Microservices monorepo with npm workspaces
- **Code Quality**: SOLID principles, clean code practices, comprehensive comments

## License

MIT

