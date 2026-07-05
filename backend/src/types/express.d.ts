declare global {
  namespace Express {
    interface Request {
      /** Set when a route writes a semantic audit event via auditAction(). */
      semanticAuditRecorded?: boolean;
    }
  }
}

export {};
