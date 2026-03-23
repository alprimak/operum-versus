import express from 'express';
import cors from 'cors';
import { initDatabase } from './models/database.js';
import { authRouter } from './routes/auth.js';
import { projectRouter } from './routes/projects.js';
import { taskRouter } from './routes/tasks.js';
import { activityRouter } from './routes/activity.js';
import { dashboardRouter } from './routes/dashboard.js';
import { notificationRouter } from './routes/notifications.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize database
initDatabase();

// Routes
app.use('/api/auth', authRouter);
app.use('/api/projects', projectRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/activity', activityRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/notifications', notificationRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`TaskFlow server running on port ${PORT}`);
  });
}

export { app };
