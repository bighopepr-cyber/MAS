import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    const bodyObject = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
    const rawMessage = bodyObject.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join("; ")
      : typeof rawMessage === "string"
        ? rawMessage
        : status >= 500
          ? "Terjadi kesalahan internal."
          : "Request tidak dapat diproses.";
    const code = typeof bodyObject.code === "string"
      ? bodyObject.code
      : this.defaultCode(status);
    const details = typeof bodyObject.details === "object" && bodyObject.details !== null
      ? bodyObject.details
      : {};
    const requestId = typeof request.headers["x-request-id"] === "string"
      ? request.headers["x-request-id"]
      : randomUUID();

    response.setHeader("x-request-id", requestId);
    response.status(status).json({
      success: false,
      message,
      error: { code, details },
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      requestId,
    });
  }

  private defaultCode(status: number): string {
    if (status === HttpStatus.UNAUTHORIZED) return "AUTH_INVALID_CREDENTIALS";
    if (status === HttpStatus.FORBIDDEN) return "PERMISSION_DENIED";
    if (status === HttpStatus.NOT_FOUND) return "RESOURCE_NOT_FOUND";
    if (status === HttpStatus.CONFLICT) return "DUPLICATE_REQUEST";
    if (status === HttpStatus.TOO_MANY_REQUESTS) return "RATE_LIMIT_EXCEEDED";
    if (status === HttpStatus.SERVICE_UNAVAILABLE) return "SERVICE_UNAVAILABLE";
    if (status === HttpStatus.UNPROCESSABLE_ENTITY) return "VALIDATION_ERROR";
    if (status === HttpStatus.BAD_REQUEST) return "VALIDATION_ERROR";
    return "INTERNAL_SERVER_ERROR";
  }
}