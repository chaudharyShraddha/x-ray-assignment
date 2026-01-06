/**
 * X-Ray API Server (Microservice)
 * 
 * Main entry point for the API service.
 * Initializes database connection and sets up Express routes.
 * Follows Single Responsibility Principle - only handles server setup.
 */

import 'reflect-metadata';
import express, { Express, Request, Response, NextFunction } from 'express';
import * as dotenv from 'dotenv';
import { initializeDatabase } from './db/data-source';
import runsRouter from './routes/runs';
import stepsRouter from './routes/steps';

dotenv.config();

const app: Express = express();
const PORT = process.env.API_PORT || 3000;

// ============================================================================
// Middleware
// ============================================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// ============================================================================
// Routes
// ============================================================================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'xray-api',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/runs', runsRouter);
app.use('/api/steps', stepsRouter);

app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'X-Ray API',
    version: '1.0.0',
    service: 'api',
    endpoints: {
      health: '/health',
      runs: '/api/runs',
      steps: '/api/steps'
    }
  });
});

// ============================================================================
// Error Handling
// ============================================================================

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// ============================================================================
// Server Initialization
// ============================================================================

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`🚀 X-Ray API microservice running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
