import { Router, Request, Response } from "express"
import { z } from "zod"
import asyncHandler from "express-async-handler"
import { db } from "../config/db.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { protect, instructorOnly, AuthRequest } from "../middlewares/auth.middleware.js"

const anticheatRouter = Router({ mergeParams: true })

// Schema for reporting focus loss
const ReportFocusLossSchema = z.object({
  event_type: z.string().min(1),
  duration_seconds: z.number().int().min(0)
})

// POST /api/assessments/:id/focus-loss (student only)
anticheatRouter.post(
  "/focus-loss",
  protect,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assessmentId = parseInt(req.params.id, 10)
    const studentId = req.user!.userId

    if (isNaN(assessmentId)) {
      throw new ApiError("Invalid assessment ID", 400)
    }

    const { event_type, duration_seconds } = ReportFocusLossSchema.parse(req.body)

    // Verify the student is part of the classroom for this assessment
    const { rows: enrollRows } = await db.query(
      `SELECT 1 
       FROM assessments a
       JOIN classroom_students cs ON a.classroom_id = cs.classroom_id
       WHERE a.assessment_id = $1 AND cs.student_id = $2`,
      [assessmentId, studentId]
    )

    if (!enrollRows.length) {
      throw new ApiError("Not authorized for this assessment", 403)
    }

    // Insert the focus loss log
    const { rows } = await db.query(
      `INSERT INTO focus_loss_logs (assessment_id, student_id, event_type, duration_seconds)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [assessmentId, studentId, event_type, duration_seconds]
    )

    res.status(201).json(new ApiResponse(true, "Focus loss logged successfully", rows[0]))
  })
)

// GET /api/assessments/:id/focus-loss/summary (instructor only)
anticheatRouter.get(
  "/focus-loss/summary",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assessmentId = parseInt(req.params.id, 10)
    const teacherId = req.user!.userId

    if (isNaN(assessmentId)) {
      throw new ApiError("Invalid assessment ID", 400)
    }

    // Verify assessment ownership
    const { rows: assessRows } = await db.query(
      `SELECT 1 FROM assessments WHERE assessment_id = $1 AND teacher_id = $2`,
      [assessmentId, teacherId]
    )
    if (!assessRows.length) {
      throw new ApiError("Assessment not found", 404)
    }

    // Get summary for each student
    const { rows } = await db.query(
      `SELECT 
        u.user_id AS "studentId",
        u.username,
        COUNT(fll.log_id) AS "totalIncidents",
        COALESCE(SUM(fll.duration_seconds), 0) AS "totalTimeSeconds"
       FROM focus_loss_logs fll
       JOIN users u ON fll.student_id = u.user_id
       WHERE fll.assessment_id = $1
       GROUP BY u.user_id, u.username
       ORDER BY u.username`,
      [assessmentId]
    )

    res.status(200).json(new ApiResponse(true, "Focus loss summary retrieved", rows))
  })
)

// GET /api/assessments/:id/focus-loss/students/:studentId (instructor only)
anticheatRouter.get(
  "/focus-loss/students/:studentId",
  protect,
  instructorOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assessmentId = parseInt(req.params.id, 10)
    const studentId = parseInt(req.params.studentId, 10)
    const teacherId = req.user!.userId

    if (isNaN(assessmentId) || isNaN(studentId)) {
      throw new ApiError("Invalid IDs", 400)
    }

    // Verify assessment ownership
    const { rows: assessRows } = await db.query(
      `SELECT 1 FROM assessments WHERE assessment_id = $1 AND teacher_id = $2`,
      [assessmentId, teacherId]
    )
    if (!assessRows.length) {
      throw new ApiError("Assessment not found", 404)
    }

    // Get detailed log for the student
    const { rows } = await db.query(
      `SELECT 
        log_id AS "logId",
        event_type AS "eventType",
        occurred_at AS "occurredAt",
        duration_seconds AS "durationSeconds"
       FROM focus_loss_logs
       WHERE assessment_id = $1 AND student_id = $2
       ORDER BY occurred_at`,
      [assessmentId, studentId]
    )

    res.status(200).json(new ApiResponse(true, "Student focus log retrieved", rows))
  })
)

export default anticheatRouter
