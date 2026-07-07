import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import axios from "axios";
import http from "http";
import crypto from "crypto";

import authRoutes from "./modules/auth.js";
import classroomRoutes from "./modules/classroom.js";
import problemRoutes from "./modules/problem.js";
import testcaseRoutes from "./modules/testcase.js";
import workingSolutionRoutes from "./modules/workingsolution.js";
import { assessmentRouter } from "./modules/assessment.js";

import { errorHandler } from "./middlewares/error.middlware.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(cookieParser());

const JUDGE0_API = process.env.JUDGE0_API || 'http://localhost:2358';

const ALLOWED_LANGUAGES = {
  python: 71,
  c: 50,
  cpp: 54,
  java: 62,
};

const CPU_TIME_LIMITS = {
  python: 2,
  c: 4,
  cpp: 4,
  java: 6,
};

const WALL_TIME_LIMITS = {
  python: 5,
  c: 15,
  cpp: 15,
  java: 20,
};

const MAX_CONCURRENT_EXECUTIONS = 6;
const MAX_QUEUE = 100;
let activeCount = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (activeCount < MAX_CONCURRENT_EXECUTIONS) {
      activeCount++;
      resolve();
    } else {
      if (waitQueue.length >= MAX_QUEUE) {
        return reject(new Error("Server busy. Please try again in a few seconds."));
      }
      waitQueue.push(resolve);
    }
  });
}

function releaseSlot() {
  activeCount--;
  const next = waitQueue.shift();
  if (next) {
    activeCount++;
    next();
  }
}

const agent = new http.Agent({
  keepAlive: true,
  maxSockets: MAX_CONCURRENT_EXECUTIONS
});

const judge0 = axios.create({
  baseURL: JUDGE0_API,
  timeout: 30000,
  httpAgent: agent
});

app.post('/run', async (req, res) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] request received`);

  const { sourceCode, language, stdin } = req.body;

  if (!sourceCode || !language) {
    return res.status(400).json({ 
      error: 'sourceCode and language are required',
      received: { sourceCode: !!sourceCode, language: !!language }
    });
  }

  const languageId = ALLOWED_LANGUAGES[language as keyof typeof ALLOWED_LANGUAGES];
  if (!languageId) {
    return res.status(400).json({
      error: `Unsupported language "${language}". Allowed: ${Object.keys(ALLOWED_LANGUAGES).join(', ')}`
    });
  }

  try {
    console.log(`[${requestId}] queued`);
    await acquireSlot();
    
    try {
      console.log(`[${requestId}] started execution`);
      const { data } = await judge0.post("/submissions?wait=true", {
        source_code: sourceCode,
        language_id: languageId,
        stdin: stdin || '',
        cpu_time_limit: CPU_TIME_LIMITS[language as keyof typeof CPU_TIME_LIMITS],
        wall_time_limit: WALL_TIME_LIMITS[language as keyof typeof WALL_TIME_LIMITS],
        memory_limit: 256000,
      });

      console.log(`[${requestId}] finished execution`);
      res.json({
        status: data.status.description,
        stdout: data.stdout,
        stderr: data.stderr,
        compile_output: data.compile_output,
        time: data.time,
        memory: data.memory,
      });
    } finally {
      releaseSlot();
    }
  } catch (err: any) {
    console.log(`[${requestId}] failed: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/classrooms", classroomRoutes);
app.use("/api/assessments", assessmentRouter);
app.use("/api/problems", problemRoutes);
app.use("/api/problems/:id/testcases", testcaseRoutes);
app.use("/api/problems/:id/validate", workingSolutionRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Judge0 API: ${JUDGE0_API}`);
  console.log(`⚡ Max concurrent executions: ${MAX_CONCURRENT_EXECUTIONS}`);
});