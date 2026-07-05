import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { auditAction } from '../../middleware/audit.js';
import { getPolicy, savePolicy } from '../../services/policy.js';
import { validatePolicyDocument } from '../../services/policy-validation.js';
import { PolicyDocument } from '../../types/index.js';

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
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ error: 'Validation Error', details: errors.array(), correlationId: req.id });
      return;
    }

    try {
      const { policy, rules, domains } = req.body as Pick<
        PolicyDocument,
        'policy' | 'rules' | 'domains'
      >;

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

      const saved = await savePolicy({ policy, rules, domains }, req.user!.sub);

      await auditAction(req, 'UPDATE_POLICY', 'default', {
        ruleCount: rules.length,
        domainCount: domains.length,
      });

      res.json(saved);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
