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
.then(() => console.log("Database Connected"))
.catch((err) => console.error("DB connection error:", err))