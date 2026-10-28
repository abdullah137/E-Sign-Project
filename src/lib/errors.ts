export class DomainError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code = "bad_request", status = 400, details?: unknown) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, "validation_error", 422, details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Not found.") {
    super(message, "not_found", 404);
    this.name = "NotFoundError";
  }
}

export class PermissionError extends DomainError {
  constructor(message = "You do not have permission to perform this action.") {
    super(message, "forbidden", 403);
    this.name = "PermissionError";
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: unknown) {
    super(message, "conflict", 409, details);
    this.name = "ConflictError";
  }
}
