import { Request, Response, NextFunction } from "express"
import {ApiError} from "../utils/ApiError.js"

export const errorHandler = (
    err: Error,
    _: Request,
    res: Response,
    __: NextFunction
) => {
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message
        })
    }

    console.error(err)

    return res.status(500).json({
        success: false,
        message: "Internal Server Error"
    })
}