import { createHash, randomUUID } from 'node:crypto';
import { esClient } from '../elasticsearch/client.js';
import { INDEX_NAMES } from '../elasticsearch/indices.js';

export const DOCS_VISITOR_COOKIE = 'interop_docs_visitor';

export interface FeedbackResult {
  success: boolean;
  error?: string;
}

/** Deterministic Elasticsearch document id — one feedback per page per visitor. */
export function feedbackDocId(pagePath: string, visitorId: string): string {
  return createHash('sha256')
    .update(`feedback:${pagePath}:${visitorId}`)
    .digest('hex')
    .slice(0, 32);
}

export function isEsConflict(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    (err as { statusCode: number }).statusCode === 409
  );
}

export async function recordDocsFeedback(input: {
  pagePath: string;
  helpful: 'yes' | 'no';
  visitorId: string;
  message?: string;
  pageTitle?: string;
}): Promise<FeedbackResult> {
  const { pagePath, helpful, visitorId, message, pageTitle } = input;

  try {
    await esClient.create({
      index: INDEX_NAMES.DOCS_FEEDBACK,
      id: feedbackDocId(pagePath, visitorId),
      document: {
        page_path: pagePath,
        helpful,
        visitor_id: visitorId,
        ...(pageTitle ? { page_title: pageTitle.slice(0, 200) } : {}),
        ...(message ? { message: message.trim().slice(0, 500) } : {}),
        '@timestamp': new Date().toISOString(),
      },
    });
    return { success: true };
  } catch (err) {
    if (isEsConflict(err)) {
      return { success: false, error: "You've already submitted feedback for this page." };
    }
    throw err;
  }
}

export function newVisitorId(): string {
  return randomUUID();
}
