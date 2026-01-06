# X-Ray System Architecture

## Overview

X-Ray is a debugging and observability system for multi-step, non-deterministic algorithmic processes. It captures decision context at each step (inputs, candidates, filters, outcomes, reasoning) to enable debugging of "why" decisions were made.

---

## Data Model

### Core Entities

```
Run (1) ──< (many) Step (1) ──< (many) Candidate
                │
                └──< (many) Filter
```

**Run**: Single pipeline execution
- Tracks pipeline identity, status, input/output, metadata

**Step**: Decision point within a run
- Captures step type, input/output, reasoning, configuration
- Tracks metrics: input count, output count, duration

**Candidate**: Item evaluated at a step
- Flexible `data` field (JSONB) accommodates any candidate type
- Tracks status (accepted/rejected), score, rejection reason

**Filter**: Constraint applied at a step
- Tracks filter type, configuration, impact metrics

### Data Model Rationale

**Why normalized relational model?**

1. **Queryability**: Enables complex cross-pipeline queries (e.g., "all filtering steps that eliminated >90%") without expensive joins across document boundaries.

2. **Scalability**: Indexes on `step_type`, `run_id`, `status` support efficient queries. Normalized structure allows PostgreSQL query planner to optimize.

3. **Flexibility**: JSONB fields (`data`, `metadata`, `config`) allow extensibility without schema changes. Different pipelines can store different candidate structures in the same table.

**Alternatives considered:**

1. **Event sourcing**: Rejected—harder to query current state, overkill for debugging use case. Would require replaying events to understand decision path.

2. **Single document per run** (MongoDB-style): Rejected—can't efficiently query across runs. Querying "all filtering steps" would require scanning all runs and extracting steps client-side.

3. **Graph database**: Rejected—less familiar tooling, SQL sufficient for this relational structure. Overhead not justified for this use case.

**What would break with different choices?**

- **Without normalization**: Cross-pipeline queries become expensive or impossible. Can't efficiently find "all filtering steps across all pipelines" without scanning every run document.

- **Without JSONB fields**: Schema changes required for each new pipeline type. Adding a new candidate field would require ALTER TABLE, breaking existing pipelines.

- **Without step-level candidates**: Can't track how candidates transform through pipeline. Would lose visibility into why a candidate was rejected at step 3 but accepted at step 5.

---

## Debugging Walkthrough

**Scenario**: A competitor selection run returns a bad match—a phone case matched against a laptop stand.

**Step-by-step investigation:**

1. **Query the run**: `GET /api/runs/{runId}`
   - Response includes full run with all steps, candidates, and filters
   - See `input`: `{ title: "Phone Case for iPhone", category: "Accessories" }`
   - See `output`: `{ competitor: { title: "Laptop Stand", category: "Office Supplies" } }`

2. **Examine Step 1 (Keyword Generation)**:
   - Check `output.keywords`: `["laptop", "stand", "desk", "office"]`
   - **Issue found**: Wrong keywords generated (should be `["phone", "case", "iphone"]`)
   - Query: `GET /api/steps/{step1Id}` to see reasoning and input

3. **Examine Step 2 (Search)**:
   - Check `candidates`: See all products retrieved
   - Laptop Stand appears here, but so does Phone Case
   - **Not the root cause**: Search returned both relevant and irrelevant products

4. **Examine Step 3 (Filtering)**:
   - Check `filters`: See `{ filterType: "price-range", config: { min: 15, max: 30 } }`
   - Check `candidates` with `status: 'rejected'`: Phone Case (price: 12.99) was rejected
   - Check `candidates` with `status: 'accepted'`: Laptop Stand (price: 29.99) passed
   - **Issue found**: Missing category filter—should reject Office Supplies products
   - Query: `GET /api/steps/{step3Id}/candidates?status=rejected` to see all rejected items

5. **Examine Step 4 (Ranking)**:
   - Check `candidates` sorted by `score`: Laptop Stand ranked #1
   - See `score: 9.2` (artificially boosted due to keyword match)
   - **Issue found**: Ranking algorithm favors wrong keywords

6. **Examine Step 5 (Selection)**:
   - Check `output.selected`: Laptop Stand selected
   - Review `reasoning` at each step to understand decision path

**Specific queries used:**
```bash
GET /api/runs/{runId}
GET /api/steps/{step3Id}/candidates?status=rejected
GET /api/steps/query/by-type/filtering?pipelineId=competitor-selection
```

---

## Queryability

**Challenge**: Query "all runs where filtering step eliminated >90% of candidates" across different pipelines (competitor selection, listing optimization, categorization, etc.), each with different steps.

**Solution**: Standardized `stepType` field with convention-based naming.

**How it works:**

1. **Step Type Conventions**: SDK provides `CommonStepTypes` constants (`'filtering'`, `'ranking'`, `'search'`, etc.) as helpers, but developers can use any string. The system queries by exact match or pattern.

2. **Cross-Pipeline Query**:
   ```bash
   GET /api/steps/query/high-elimination?threshold=0.9
   ```
   Returns all steps where `stepType = 'filtering'` AND `(outputCount / inputCount) < 0.1`, regardless of pipeline.

3. **Metadata and Config Filtering**: For pipeline-specific queries, use metadata:
   ```bash
   GET /api/steps/query/by-type/filtering
   # Filter client-side by metadata.pipelineId or config.threshold
   ```

**Constraints/Conventions:**

- **Step Type Naming**: Developers encouraged to use consistent naming (e.g., `'filtering'` not `'filter-candidates'`). SDK provides constants but doesn't enforce.

- **Metadata Fields**: Use `metadata` for pipeline-specific categorization (e.g., `metadata.algorithm = 'llm-ranking'`). Enables filtering without schema changes.

- **Config Fields**: Store filter/algorithm configuration in `config` field. Enables querying by threshold, model version, etc.

**Variability Handling:**

Different pipelines have different steps, but queryability is maintained through:

- **Pattern Matching**: Query API supports `stepType LIKE '%filter%'` to find all filtering-related steps across pipelines.

- **Metadata Queries**: Filter by `metadata.algorithm`, `metadata.pipelineId`, etc. to narrow results.

- **General-Purpose Design**: No hardcoded pipeline types—any pipeline can be instrumented. Flexible `data` field accommodates any candidate structure.

**Example**: Find all LLM-based ranking steps across any pipeline:
```bash
GET /api/steps/query/by-type/ranking
# Then filter by metadata.algorithm = 'llm-ranking' client-side
```

---

## Performance & Scale

**Problem**: A step takes 5,000 candidates as input and filters down to 30. Capturing full details for all 5,000 (including rejection reasons) might be prohibitively expensive.

**Strategy**: Configurable detail level with automatic optimization.

**Two Approaches:**

1. **Full Capture** (`captureAllCandidates: true` or count < 100)
   - Stores all 5,000 candidates (accepted + rejected)
   - **Storage**: High (5,000 × candidate size)
   - **Use Case**: Critical debugging, small sets
   - **Performance Impact**: High (5,000 DB writes)

2. **Hybrid** (Default for large sets)
   - Captures top 50 accepted (by score) + random 20 rejected
   - Stores all candidates with status tracking
   - **Storage**: Moderate (70 DB writes)
   - **Use Case**: Production, large candidate sets
   - **Performance Impact**: Moderate

**Trade-offs:**

| Approach | Storage Cost | Debugging Detail | Performance Impact |
|----------|--------------|------------------|-------------------|
| Full Capture | High | Complete | High (5,000 DB writes) |
| Hybrid | Moderate | Good | Moderate (70 DB writes) |

**Who Decides?**

- **Developer**: Sets `captureAllCandidates` flag per step for explicit control
- **SDK**: Provides sensible defaults (full if <100, hybrid if >=100)
- **System**: Can enforce limits (e.g., max 10,000 candidates per step)

**Implementation**: SDK automatically chooses strategy based on count and flag. Developer can override per step for critical debugging scenarios.

---

## Developer Experience

### Minimal Instrumentation

**What changes are needed?** Wrap your pipeline with X-Ray calls.

```typescript
const xray = new XRay({ apiUrl: 'http://localhost:3000' });

const run = await xray.startRun({
  pipelineId: 'competitor-selection',
  pipelineVersion: '1.0.0',
  input: sellerProduct
});

const step = await xray.startStep({
  stepType: 'filtering',
  input: candidates,
  reasoning: 'Filtering by price range'
});

const filtered = await yourFilterFunction(candidates);
await xray.completeStep(step.id, { count: filtered.length });

await xray.completeRun({ result: bestCompetitor });
```

**Result**: Basic visibility—can see steps, timing, input/output.

### Full Instrumentation

**Additional changes**:
- Record candidates at each step
- Record filters with impact metrics
- Add reasoning text to steps
- Configure candidate capture strategy

```typescript
// Record candidates
await xray.recordCandidates(
  step.id,
  candidates.map(c => ({
    candidateId: c.id,
    data: c,
    score: c.rating
  })),
  acceptedIds
);

// Record filters
await xray.recordFilter(step.id, {
  filterType: 'price-range',
  config: { min: 10, max: 30 },
  candidatesAffected: 5000,
  candidatesRejected: 4970
});
```

**Result**: Complete visibility—can debug why each decision was made.

### Backend Unavailable

**Behavior**: SDK throws errors when API is unavailable (fail-fast behavior).

```typescript
try {
  await xray.startRun({ pipelineId: 'my-pipeline', input: data });
} catch (error) {
  // Handle API unavailability - pipeline should fail fast
  console.error('[X-Ray] API unavailable:', error);
  throw error; // Fail fast to ensure data integrity
}
```

**Impact**: Pipeline fails if X-Ray API is unavailable. This ensures that debugging data is always captured when the pipeline runs successfully. Developers should handle API failures appropriately in their error handling logic.

---

## Real-World Application

**System**: E-commerce recommendation engine that suggests products to users based on browsing history and preferences.

**Problem**: The system occasionally suggests irrelevant products (e.g., laptop accessories for someone browsing phone cases). Traditional logging showed function calls and timing, but not why a product was selected over alternatives.

**How X-Ray would help:**

1. **Step 1: User Intent Extraction** (LLM)
   - See extracted keywords and intent classification
   - Debug: Was intent misclassified? Check `output.intent` and `reasoning`

2. **Step 2: Candidate Retrieval** (Search)
   - See all retrieved products with scores
   - Debug: Did search return wrong category? Check `candidates` and their `data.category`

3. **Step 3: Filtering** (Business Rules)
   - See which filters eliminated products
   - Debug: Were filters too strict/loose? Check `filters` and `candidates` with `status: 'rejected'`

4. **Step 4: Ranking** (ML Model)
   - See ranking scores and reasoning
   - Debug: Why did irrelevant product rank higher? Check `candidates` sorted by `score`

**Retrofit Approach**:
- Wrap existing functions with `xray.startStep()` / `xray.completeStep()`
- Add `xray.recordCandidates()` after search/retrieval steps
- Add `xray.recordFilter()` where business rules are applied
- Minimal code changes—mostly wrapping existing logic

**Time Saved**: Instead of adding print statements and re-running, query X-Ray API to see exact decision path for any failed recommendation. Reduced debugging time from hours to minutes.

---

## What Next?

If shipping this SDK for real-world use cases, technical aspects to work on:

1. **Real-time Streaming**: WebSocket support for live debugging—stream step updates as pipeline executes.

2. **Advanced Querying**: GraphQL API for flexible queries, time-series analysis (trends over time), anomaly detection (unusual elimination rates).

3. **Performance Optimizations**: Batch candidate writes, async queue for API calls, compression for large candidate payloads.

4. **Visualization**: Web UI for exploring runs, decision tree visualization, comparison view (compare two runs side-by-side).

5. **Multi-language SDKs**: Python, Go, Java SDKs for broader adoption.

6. **Security & Privacy**: PII scrubbing for candidate data, access control (who can view which runs), data retention policies.

7. **Sampling Strategies**: Intelligent sampling (not just random), sample by rejection reason distribution, adaptive sampling based on step importance.

8. **Integration**: Integration with existing observability tools (Datadog, New Relic), export to data warehouses (BigQuery, Snowflake).

---

## API Specification

### Ingest Endpoints

**POST /api/runs**
```json
{
  "pipelineId": "competitor-selection",
  "pipelineVersion": "1.0.0",
  "input": {...},
  "metadata": {...}
}
```

**POST /api/steps**
```json
{
  "runId": "uuid",
  "stepType": "filtering",
  "input": {...},
  "config": {...},
  "reasoning": "...",
  "captureAllCandidates": false
}
```

**POST /api/steps/:stepId/candidates**
```json
{
  "candidates": [
    {
      "candidateId": "P001",
      "data": {...},
      "status": "accepted",
      "score": 4.5,
      "metadata": {...}
    }
  ]
}
```

**POST /api/steps/:stepId/filters**
```json
{
  "filterType": "price-range",
  "config": {"min": 10, "max": 30},
  "candidatesAffected": 5000,
  "candidatesRejected": 4970
}
```

**PATCH /api/runs/:id** - Update run (status, output, error)
**PATCH /api/steps/:id** - Update step (status, output, inputCount, outputCount, durationMs, reasoning)

### Query Endpoints

- **GET /api/runs/:id** - Get run with all steps, candidates, filters
- **GET /api/runs** - List runs (query params: `pipelineId`, `status`, `limit`, `offset`)
- **GET /api/steps/:id** - Get step with candidates and filters
- **GET /api/steps/:stepId/candidates** - Get candidates (query params: `status`, `limit`)
- **GET /api/steps/query/high-elimination** - Find steps that eliminated >threshold% (query param: `threshold`)
- **GET /api/steps/query/by-type/:stepType** - Find steps by type (query params: `limit`, `offset`)
- **GET /health** - Health check

---

## Implementation

**Technology Stack**:
- Database: PostgreSQL with TypeORM
- API: Express.js with TypeScript
- SDK: Axios HTTP client
- Architecture: Microservices monorepo with npm workspaces

**SDK Methods**:
- `startRun(options)` - Create pipeline run
- `completeRun(output?, error?)` - Mark run completed/failed
- `startStep(options)` - Create step
- `completeStep(stepId, output?, error?, reasoning?)` - Mark step completed
- `recordCandidates(stepId, candidates, acceptedIds)` - Record candidates
- `recordFilter(stepId, options)` - Record filter
- `getCurrentRun()` - Get active run

**Code Organization**:
- Separate packages for SDK and API
- Shared types in `@xray/shared` package
- TypeORM entities and repositories
- SOLID principles, clean code practices
