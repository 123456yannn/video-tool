import path from 'path';
import fs from 'fs';
import type { Job } from '../types';

export const DATA_DIR = path.join(process.env.COZE_WORKSPACE_PATH || '/workspace/projects', 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const MATERIALS_DIR = path.join(DATA_DIR, 'materials');
export const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');

export function ensureDirs(): void {
  const dirs = [
    DATA_DIR,
    UPLOADS_DIR,
    MATERIALS_DIR,
    path.join(MATERIALS_DIR, 'product-closeup'),
    path.join(MATERIALS_DIR, 'environment'),
    path.join(MATERIALS_DIR, 'human'),
    path.join(MATERIALS_DIR, 'production-line'),
    path.join(MATERIALS_DIR, 'dynamic-to-static'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export function loadJobs(): Record<string, Job> {
  try {
    if (fs.existsSync(JOBS_FILE)) {
      const data = fs.readFileSync(JOBS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // ignore
  }
  return {};
}

export function saveJobs(jobs: Record<string, Job>): void {
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2), 'utf-8');
}

export function getJob(id: string): Job | null {
  const jobs = loadJobs();
  return jobs[id] || null;
}

export function updateJob(id: string, updates: Partial<Job>): Job | null {
  const jobs = loadJobs();
  if (!jobs[id]) return null;
  jobs[id] = { ...jobs[id], ...updates, updatedAt: new Date().toISOString() };
  saveJobs(jobs);
  return jobs[id];
}

export function createJob(job: Job): void {
  const jobs = loadJobs();
  jobs[job.id] = job;
  saveJobs(jobs);
}
