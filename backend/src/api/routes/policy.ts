import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { auditAction } from '../../middleware/audit.js';
import { getPolicy, savePolicy, PolicyVersionConflictError } from '../../services/policy.js';
import { validatePolicyDocument } from '../../services/policy-validation.js';
import { PolicyDocument } from '../../types/index.js';
import { config } from '../../config/index.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const doc = await getPolicy();
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

router.put(
  '/',
  [
    body('policy').isObject(),
    body('rules').isArray(),
    body('domains').isArray(),
    body('ifSeqNo').optional().isInt({ min: 0 }),
    body('ifPrimaryTerm').optional().isInt({ min: 1 }),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ error: 'Validation Error', details: errors.array(), correlationId: req.id });
      return;
    }

    try {
      const { policy, rules, domains, ifSeqNo, ifPrimaryTerm } = req.body as Pick<
        PolicyDocument,
        'policy' | 'rules' | 'domains'
      > & { ifSeqNo?: number; ifPrimaryTerm?: number };

      // Deep structural validation — a malformed policy drives real governance
      // decisions, so reject anything that isn't shaped correctly.
      const structuralErrors = validatePolicyDocument({ policy, rules, domains });
      if (structuralErrors.length > 0) {
        res.status(422).json({
          error: 'Validation Error',
          message: 'Policy document failed structural validation.',
          details: structuralErrors,
          correlationId: req.id,
        });
        return;
      }

      if (config.nodeEnv === 'production' && (ifSeqNo === undefined || ifPrimaryTerm === undefined)) {
        res.status(428).json({
          error: 'Precondition Required',
          message: 'Policy save requires ifSeqNo and ifPrimaryTerm from the latest GET /api/policy response.',
          correlationId: req.id,
        });
        return;
      }

      const saved = await savePolicy(
        { policy, rules, domains },
        req.user!.sub,
        ifSeqNo !== undefined && ifPrimaryTerm !== undefined
          ? { ifSeqNo, ifPrimaryTerm }
          : {},
      );

      await auditAction(req, 'UPDATE_POLICY', 'default', {
        ruleCount: rules.length,
        domainCount: domains.length,
      });

      res.json(saved);
    } catch (err) {
      if (err instanceof PolicyVersionConflictError) {
        res.status(409).json({
          error: 'Conflict',
          message: 'Policy was modified by another admin. Reload and try again.',
          correlationId: req.id,
        });
        return;
      }
      next(err);
    }
  },
);

export default router;
