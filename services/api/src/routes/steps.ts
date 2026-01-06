/**
 * Steps API Routes
 * 
 * Handles HTTP requests for Step resources.
 * Follows Single Responsibility Principle - only handles routing logic.
 */

import { Router, Request, Response } from 'express';
import { StepsRepository } from '../repositories/steps';
import { CandidatesRepository } from '../repositories/candidates';
import { FiltersRepository } from '../repositories/filters';
import { Candidate } from '@xray/shared';

const router = Router();

const stepsRepo = new StepsRepository();
const candidatesRepo = new CandidatesRepository();
const filtersRepo = new FiltersRepository();

/**
 * POST /api/steps
 * Creates a new step
 * 
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const step = await stepsRepo.create(req.body);
    res.status(201).json(step);
  } catch (error: any) {
    res.status(400).json({
      error: error.message || 'Failed to create step'
    });
  }
});

/**
 * GET /api/steps/:id
 * Gets a step by ID with all candidates and filters
 * 
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const step = await stepsRepo.findById(req.params.id);

    if (!step) {
      return res.status(404).json({ error: 'Step not found' });
    }

    const [candidates, filters] = await Promise.all([
      candidatesRepo.findByStepId(step.id),
      filtersRepo.findByStepId(step.id)
    ]);

    res.json({
      ...step,
      candidates,
      filters
    });
  } catch (error: any) {
    console.error('Error fetching step:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * PATCH /api/steps/:id
 * Updates a step (typically to mark as completed or add output)
 * 
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const step = await stepsRepo.update(req.params.id, req.body);
    res.json(step);
  } catch (error: any) {
    res.status(400).json({
      error: error.message || 'Failed to update step'
    });
  }
});

/**
 * GET /api/steps/query/high-elimination
 * Query routes must come before parameterized routes to avoid route conflicts
 * Finds filtering steps that eliminated more than threshold% of candidates
 * 
 */
router.get('/query/high-elimination', async (req: Request, res: Response) => {
  try {
    const threshold = req.query.threshold
      ? parseFloat(req.query.threshold as string)
      : 0.9;

    const steps = await stepsRepo.findFilteringStepsWithHighElimination(threshold);
    res.json(steps);
  } catch (error: any) {
    console.error('Error querying high-elimination steps:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/steps/query/by-type/:stepType
 * Finds all steps of a specific type
 * 
 */
router.get('/query/by-type/:stepType', async (req: Request, res: Response) => {
  try {
    const { limit, offset } = req.query;

    const steps = await stepsRepo.findByStepType(req.params.stepType, {
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined
    });
    
    res.json(steps);
  } catch (error: any) {
    console.error('Error querying steps by type:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /api/steps/:stepId/candidates
 * Adds candidates to a step (bulk operation)
 * 
 */
router.post('/:stepId/candidates', async (req: Request, res: Response) => {
  try {
    const { candidates } = req.body;

    if (!Array.isArray(candidates)) {
      return res.status(400).json({
        error: 'candidates must be an array'
      });
    }

    const candidatesWithStepId: Candidate[] = candidates.map((c: any) => ({
      stepId: req.params.stepId,
      ...c
    }));

    const created = await candidatesRepo.createMany(candidatesWithStepId);
    res.status(201).json(created);
  } catch (error: any) {
    res.status(400).json({
      error: error.message || 'Failed to create candidates'
    });
  }
});

/**
 * GET /api/steps/:stepId/candidates
 * Gets candidates for a step with optional filters
 * 
 */
router.get('/:stepId/candidates', async (req: Request, res: Response) => {
  try {
    const { status, limit } = req.query;

    const candidates = await candidatesRepo.findByStepId(req.params.stepId, {
      status: status as 'accepted' | 'rejected' | 'pending',
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json(candidates);
  } catch (error: any) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /api/steps/:stepId/filters
 * Adds a filter to a step
 * 
 */
router.post('/:stepId/filters', async (req: Request, res: Response) => {
  try {
    const filter = {
      stepId: req.params.stepId,
      ...req.body
    };

    const created = await filtersRepo.create(filter);
    res.status(201).json(created);
  } catch (error: any) {
    res.status(400).json({
      error: error.message || 'Failed to create filter'
    });
  }
});

export default router;
