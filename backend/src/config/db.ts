import {Pool} from "pg"
import dotenv from "dotenv"

dotenv.config()

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing")
}

export const db = new Pool({
    connectionString: process.env.DATABASE_URL
})

db.connect()
.then(async (client) => {
    console.log("Database Connected")
    try {
        await client.query(`
            ALTER TABLE assessments ADD COLUMN IF NOT EXISTS grading_preset VARCHAR(30) NOT NULL DEFAULT 'Correctness Only';
            ALTER TABLE submissions ADD COLUMN IF NOT EXISTS final_score DECIMAL(5,2);
        `)
        console.log("Database migrations applied successfully.")
    } catch (migErr) {
        console.error("Migration error:", migErr)
    } finally {
        client.release()
    }
})
.catch((err) => console.error("DB connection error:", err))