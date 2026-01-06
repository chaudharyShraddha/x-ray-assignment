/**
 * Runs API Routes
 * 
 * Handles HTTP requests for Run resources.
 * Follows Single Responsibility Principle - only handles routing logic.
 * Delegates business logic to repositories (Separation of Concerns).
 */

import { Router, Request, Response } from 'express';
import { RunsRepository } from '../repositories/runs';
import { StepsRepository } from '../repositories/steps';
import { CandidatesRepository } from '../repositories/candidates';
import { FiltersRepository } from '../repositories/filters';

const router = Router();

const runsRepo = new RunsRepository();
const stepsRepo = new StepsRepository();
const candidatesRepo = new CandidatesRepository();
const filtersRepo = new FiltersRepository();

/**
 * POST /api/runs
 * Creates a new run
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const run = await runsRepo.create(req.body);
    res.status(201).json(run);
  } catch (error: any) {
    res.status(400).json({
      error: error.message || 'Failed to create run'
    });
  }
});

/**
 * GET /api/runs/:id
 * Gets a run by ID with all related steps, candidates, and filters
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const run = await runsRepo.findById(req.params.id);

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const steps = await stepsRepo.findByRunId(run.id);

    const stepsWithDetails = await Promise.all(
      steps.map(async (step) => {
        const [candidates, filters] = await Promise.all([
          candidatesRepo.findByStepId(step.id, { limit: 100 }),
          filtersRepo.findByStepId(step.id)
        ]);

        return {
          ...step,
          candidates,
          filters
        };
      })
    );

    res.json({
      ...run,
      steps: stepsWithDetails
    });
  } catch (error: any) {
    console.error('Error fetching run:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/runs
 * Lists runs with optional filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { pipelineId, status, limit, offset } = req.query;

    const runs = await runsRepo.findAll({
      pipelineId: pipelineId as string,
      status: status as 'running' | 'completed' | 'failed' | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined
    });
    
    res.json(runs);
  } catch (error: any) {
    console.error('Error listing runs:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * PATCH /api/runs/:id
 * Updates a run (typically to mark as completed or failed)
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const run = await runsRepo.update(req.params.id, req.body);
    res.json(run);
  } catch (error: any) {
    res.status(400).json({
      error: error.message || 'Failed to update run'
    });
  }
});

export default router;
