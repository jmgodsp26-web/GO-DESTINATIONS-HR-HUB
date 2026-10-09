import { Router, type CookieOptions } from 'express';
import { transact } from './persistence.js';
import { beginMicrosoft, completeMicrosoft, matchingState, microsoftConfig } from './microsoft.js';

// Dependencies allow isolated HTTP tests without contacting a real tenant.
export function microsoftRouter(sessionOptions: CookieOptions, exchange = completeMicrosoft) {
  const router = Router();
  const flowCookie = process.env.NODE_ENV === 'test' ? 'hr_ms_state' : '__Host-hr_ms_state';
  const flowOptions: CookieOptions = { httpOnly: true, secure: process.env.NODE_ENV !== 'test', sameSite: 'lax', path: '/', maxAge: 10 * 60 * 1000 };
  const cookieValue = (cookies: string | undefined, name: string) => (cookies || '').split(';').map(s => s.trim()).find(s => s.startsWith(name + '='))?.slice(name.length + 1) || '';
  router.get('/config', (_req, res) => res.json({ enabled: Boolean(microsoftConfig()) }));
  router.get('/start', async (_req, res) => {
    const config = microsoftConfig();
    if (!config) return res.redirect('/?ms_error=unavailable');
    try {
      const flow = beginMicrosoft(config);
      await transact(async database => { database.saveMicrosoftAttempt(flow.attempt); return { result: undefined, commit: true }; });
      res.cookie(flowCookie, flow.state, flowOptions);
      res.redirect(flow.url);
    } catch {
      res.redirect('/?ms_error=unavailable');
    }
  });
  router.get('/callback', async (req, res) => {
    res.clearCookie(flowCookie, { ...flowOptions, maxAge: undefined });
    const state = req.query.state;
    const config = microsoftConfig();
    if (!config || !matchingState(state, cookieValue(req.headers.cookie, flowCookie))) return res.redirect('/?ms_error=failed');
    try {
      // Consume in its own committed transaction BEFORE calling Microsoft. Replays
      // and concurrent callbacks cannot redeem one flow twice across instances.
      const attempt = await transact(async database => ({ result: database.consumeMicrosoftAttempt(state), commit: true }));
      if (!attempt || req.query.error || typeof req.query.code !== 'string' || !req.query.code || req.query.code.length > 10000) return res.redirect('/?ms_error=failed');
      const identity = await exchange(req.query.code, config, attempt);
      const signed = await transact(async database => {
        const result = database.authenticateMicrosoft(identity.tenant, identity.objectId);
        if (result) database.logout(cookieValue(req.headers.cookie, '__session'));
        return { result, commit: true };
      });
      if (!signed) return res.redirect('/?ms_error=not_approved');
      res.cookie('__session', signed.token, sessionOptions);
      return res.redirect('/');
    } catch {
      // Never log authorization codes, tokens, state, secrets or provider errors.
      return res.redirect('/?ms_error=failed');
    }
  });
  return router;
}
