import { visibleCoverage } from './server/coverage.js';
import { decodeUpload } from './server/files.js';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.js';
import { transact, initializeDatabase } from './server/persistence.js';
import { withDatabase } from './server/request-context.js';
import { getFirestoreDb } from './server/firestore.js';
import { UserProfile } from './src/types.js';

// Extend Express Request to include authenticated user
export interface AuthenticatedRequest extends Request {
  user?: UserProfile;
}

const app = express();
const apiRouter = express.Router();
const PORT = Number(process.env.PORT || 3000);

// Enable trust proxy for Cloud Run and reverse proxy environments (nginx)
app.set('trust proxy', 1);

// Production and isolated tests use the same browser protections. Local Vite
// development permits its HMR connection and the private design preview iframe.
const development = !['production', 'test'].includes(process.env.NODE_ENV || '');
app.use(helmet({
  frameguard: development ? false : { action: 'deny' },
  contentSecurityPolicy: development ? false : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'https:', 'data:', 'blob:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-origin' },
}));

// --- RATE LIMITING DEFENSE ---
// Coarse per-instance abuse guard, sized for a shared office IP. Authentication
// also has persistent per-account and per-IP counters in the database.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
  },
  message: { error: 'Too many requests from this IP. Please try again in 15 minutes.' },
});

// 2. Strict auth rate limiter to defend against brute-force password/identifier guessing
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
  },
  message: { error: 'Too many login attempts from this IP. Please wait 15 minutes before trying again.' },
});

app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);

app.use(express.json({ limit: '10mb' }));
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (req.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return res.status(415).json({ error: 'Please submit JSON requests.' });
    const origin = req.get('origin');
    const expected = process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`;
    if (origin && origin !== expected) return res.status(403).json({ error: 'Request origin not allowed.' });
  }
  next();
});

// Firebase Hosting forwards only this cookie to Cloud Run.
const COOKIE = '__session';
function sessionToken(req: Request): string {
  const item = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(COOKIE + '='));
  return item ? item.slice(COOKIE.length + 1) : '';
}
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV !== 'test', sameSite: 'lax' as const, path: '/', maxAge: 8 * 60 * 60 * 1000 };

// Hold the response until the entire HR operation commits. Each transaction retry
// receives a fresh database and router dispatch; failed operations do not persist.
app.use('/api', async (req: Request, res: Response) => {
  if (req.path === '/health') return res.json({ status: 'ok' });
  if (!['/auth/login', '/auth/logout', '/auth/reset-password'].includes(req.path) && !sessionToken(req)) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  const originalUrl = req.url;
  const send = res.send.bind(res);
  const json = res.json.bind(res);
  const end = res.end.bind(res);
  const initialHeaders = res.getHeaders();
  try {
    const outcome = await transact(async database => {
      req.url = req.originalUrl;
      res.statusCode = 200;
      for (const header of res.getHeaderNames()) res.removeHeader(header);
      for (const [header, value] of Object.entries(initialHeaders)) if (value !== undefined) res.setHeader(header, value);
      const reply = await withDatabase(database, () => new Promise<{ kind: string; body: any; status: number; headers: ReturnType<Response['getHeaders']> }>((resolve, reject) => {
        const capture = (kind: string, body: any) => {
          resolve({ kind, body, status: res.statusCode, headers: res.getHeaders() });
          return res;
        };
        res.json = ((body: any) => capture('json', body)) as any;
        res.send = ((body: any) => capture('send', body)) as any;
        res.end = ((body: any) => capture('end', body)) as any;
        apiRouter(req, res, (error?: any) => { if (error) reject(error); else { res.statusCode = 404; capture('json', { error: 'API route not found.' }); } });
      }));
      return { result: reply, commit: reply.status < 400 || (req.path === '/api/auth/login' && [401, 403, 429].includes(reply.status)) };
    });
    res.send = send; res.json = json; res.end = end as any;
    res.status(outcome.status);
    for (const [header, value] of Object.entries(outcome.headers)) if (value !== undefined) res.setHeader(header, value);
    if (outcome.kind === 'json') json(outcome.body);
    else if (outcome.kind === 'send') send(outcome.body);
    else end(outcome.body);
  } catch (error) {
    res.send = send; res.json = json; res.end = end as any;
    res.removeHeader('set-cookie');
    console.error('HR transaction failed:', error);
    res.status(503).json({ error: 'The database is temporarily unavailable. Your changes were not saved. Please try again.' });
  } finally { req.url = originalUrl; }
});

// --- AUTH MIDDLEWARE ---
function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = sessionToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required. Please log in.' });
  const user = db.getUserByToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
  }

  if (!['admin', 'employee'].includes(user.role) || user.status !== 'active') {
    return res.status(403).json({ error: 'Account disabled. Please contact HR administrator.' });
  }

  if (db.requiresPasswordChange(user.id) && !['/api/auth/me', '/api/auth/change-password'].includes(req.path)) {
    return res.status(403).json({ error: 'Please change your temporary password before continuing.', mustChangePassword: true });
  }

  req.user = user;
  next();
}

function adminOnlyMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  authMiddleware(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Administrative privileges required.' });
    }
    next();
  });
}

// --- API ROUTES ---

// Health & System Status
apiRouter.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    firestoreInitialized: Boolean(getFirestoreDb()),
  });
});

// 1. Auth routes
apiRouter.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { email, identifier, password } = req.body;
    const loginIdentifier = typeof (identifier || email) === 'string' ? (identifier || email).trim() : '';
    if (typeof password !== 'string') return res.status(400).json({ error: 'Password is required.' });
    if (!loginIdentifier) {
      return res.status(400).json({ error: 'Company email address is required.' });
    }

    const authResult = db.authenticate(loginIdentifier, password, req.ip || 'unknown');
    res.cookie(COOKIE, authResult.token, cookieOptions);
    const { token: _secret, ...publicResult } = authResult;
    res.json(publicResult);
  } catch (error: any) {
    const msg = error.message || 'Authentication failed.';
    const status = error.code === 'LOGIN_THROTTLED' ? 429 : 401;
    res.status(status).json({ error: msg });
  }
});

// Self-service password reset is disabled for compliance and security
apiRouter.post('/api/auth/reset-password', (_req: Request, res: Response) => {
  return res.status(403).json({
    error: 'Self-service password reset is disabled for security compliance. Please contact your HR administrator for a verified credential reset.',
  });
});

// Admin-controlled credential reset with mandatory temporary password
apiRouter.post('/api/admin/employees/:id/reset-password', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { temporary_password } = req.body;
    if (!temporary_password || typeof temporary_password !== 'string' || temporary_password.trim().length < 12) {
      return res.status(400).json({ error: 'Temporary password must be at least 12 characters long.' });
    }
    db.adminResetPassword(req.params.id, temporary_password.trim(), req.user!);
    res.json({ success: true, message: 'Temporary password generated and existing sessions revoked successfully.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to reset password.' });
  }
});

apiRouter.get('/api/auth/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user, mustChangePassword: db.requiresPasswordChange(req.user!.id) });
});

apiRouter.post('/api/auth/logout', (req: Request, res: Response) => {
  db.logout(sessionToken(req));
  res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ success: true });
});

apiRouter.post('/api/auth/change-password', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { current_password, new_password } = req.body;
    if (!new_password || typeof new_password !== 'string' || new_password.trim().length < 12) {
      return res.status(400).json({ error: 'New password must be at least 12 characters long.' });
    }
    db.changePassword(req.user!.id, current_password || '', new_password.trim());
    res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });
    res.json({ success: true, message: 'Password updated successfully. Please use your new password next time.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update password.' });
  }
});

// 2. Profile & Leave Balances
apiRouter.get('/api/profile', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json(req.user);
});

apiRouter.get('/api/leave-balances', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    // If admin provides employee_id query, return that employee's balance; otherwise current user
    const targetUserId =
      req.user?.role === 'admin' && req.query.employee_id
        ? (req.query.employee_id as string)
        : req.user!.id;

    const balances = db.getLeaveBalances(targetUserId);
    res.json(balances);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Leave Transactions Ledger
apiRouter.get(['/api/leave/transactions', '/api/leave-transactions'], authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetEmployeeId =
      req.user?.role === 'admin' && req.query.employee_id
        ? (req.query.employee_id as string)
        : req.user?.role === 'admin'
        ? undefined
        : req.user!.id;

    const transactions = db.getLeaveTransactions(targetEmployeeId);
    res.json(transactions);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Admin Manual Leave Balance Adjustment
apiRouter.post('/api/admin/leave-adjustments', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { employee_id, leave_type, amount, reason } = req.body;
    if (!employee_id || !leave_type || amount === undefined || !reason) {
      return res.status(400).json({ error: 'Missing required parameters for adjustment.' });
    }
    const result = db.manualBalanceAdjustment(
      employee_id,
      leave_type,
      Number(amount),
      reason,
      req.user!
    );
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to adjust balance.' });
  }
});

// 3. Leave Requests
apiRouter.get('/api/leave-requests', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, employee, leave_type, date } = req.query;
    const requests = db.getLeaveRequests(req.user!, {
      status: status as string,
      employee: employee as string,
      leave_type: leave_type as string,
      date: date as string,
    });
    res.json(requests);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

apiRouter.get('/api/leave-attachments/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const file = db.getLeaveAttachment(req.params.id, req.user!);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent(file.name));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.bytes);
  } catch { res.status(404).json({error: 'Attachment not found.'}); }
});

apiRouter.post('/api/leave-requests', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const newRequest = db.submitLeaveRequest(req.user!, req.body);
    res.status(201).json(newRequest);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to submit leave request.' });
  }
});

apiRouter.patch('/api/leave-requests/:id/review', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, admin_note } = req.body;
    if (action !== 'Approved' && action !== 'Rejected') {
      return res.status(400).json({ error: 'Action must be "Approved" or "Rejected".' });
    }

    const reviewed = db.reviewLeaveRequest(req.params.id, action, req.user!, admin_note);
    res.json(reviewed);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to process review action.' });
  }
});

apiRouter.patch('/api/leave-requests/:id/cancel', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const cancelled = db.cancelLeaveRequest(req.params.id, req.user!);
    res.json(cancelled);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to cancel leave request.' });
  }
});

apiRouter.delete('/api/leave-requests/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const cancelled = db.cancelLeaveRequest(req.params.id, req.user!);
    res.json(cancelled);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to cancel leave request.' });
  }
});

// 4. Employee Management
apiRouter.get('/api/employees', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const employees = db.getAllEmployees();
    if (req.user?.role !== 'admin') {
      // Data Minimization: Redact sensitive PII (phone, birthday, date of birth, hire date, private ledgers)
      const sanitized = employees.map((e) => ({
        id: e.id,
        user_id: e.id,
        employee_id: e.employee_id,
        full_name: e.full_name,
        email: e.email,
        department: e.department,
        job_title: e.job_title,
        avatar_url: e.avatar_url,
        status: e.status,
        country: e.country,
        is_pc: e.is_pc,
        leave_balances: [],
      }));
      return res.json(sanitized);
    }
    res.json(employees);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

apiRouter.post('/api/employees', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = db.createEmployee(req.body, req.user!);
    res.status(201).json(profile);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create employee.' });
  }
});

apiRouter.patch('/api/employees/:id', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = db.updateEmployee(req.params.id, req.body, req.user!);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update employee.' });
  }
});

apiRouter.delete('/api/employees/:id', adminOnlyMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await db.deleteEmployee(req.params.id, req.user!);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete employee.' });
  }
});

apiRouter.patch('/api/employees/:id/leave-balance', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { leave_type, allocated_days } = req.body;
    if (!leave_type || typeof allocated_days !== 'number' || allocated_days < 0) {
      return res.status(400).json({ error: 'Invalid leave type or allocation value.' });
    }

    const balance = db.adjustLeaveBalance(req.params.id, leave_type, allocated_days, req.user!);
    res.json(balance);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to adjust balance.' });
  }
});

// 5. Holidays & Staff Coverage
apiRouter.get('/api/holidays', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { country, year, holiday_type, scope, is_active, upcoming_only, reference_date } = req.query;
  const holidays = db.getHolidays({
    country: country as string,
    year: year as string,
    holiday_type: holiday_type as string,
    scope: scope as string,
    is_active: is_active !== undefined ? is_active === 'true' : undefined,
    upcoming_only: upcoming_only === 'true',
    reference_date: reference_date as string,
  });
  res.json(holidays);
});

apiRouter.post('/api/holidays', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const holiday = db.addHoliday(req.body, req.user!);
    res.status(201).json(holiday);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to add holiday.' });
  }
});

apiRouter.patch('/api/holidays/:id', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const holiday = db.updateHoliday(req.params.id, req.body, req.user!);
    res.json(holiday);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update holiday.' });
  }
});

apiRouter.patch('/api/holidays/:id/toggle-active', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const holiday = db.toggleHolidayActive(req.params.id, req.user!);
    res.json(holiday);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to toggle holiday active status.' });
  }
});

apiRouter.delete('/api/holidays/:id', adminOnlyMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await db.deleteHoliday(req.params.id, req.user!);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete holiday.' });
  }
});

// Holiday Shift Requests & Coverage
apiRouter.get('/api/holiday-shifts', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { holiday_id, holiday_date, status, employee_id } = req.query;
    // Strict server-side authorization: Standard employees can only access their own shifts
    const targetEmployeeId =
      req.user?.role === 'admin'
        ? (employee_id as string | undefined)
        : req.user!.id;

    const shifts = db.getHolidayShifts({
      holiday_id: holiday_id as string,
      holiday_date: holiday_date as string,
      status: status as string,
      employee_id: targetEmployeeId,
    });
    res.json(shifts);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

apiRouter.post('/api/holiday-shifts', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const shift = db.submitHolidayShiftRequest(req.user!, req.body);
    res.status(201).json(shift);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to submit shift request.' });
  }
});

apiRouter.post('/api/admin/holiday-shifts/assign', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const shift = db.assignHolidayShift(req.user!, req.body);
    res.status(201).json(shift);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to assign holiday shift.' });
  }
});

apiRouter.patch('/api/holiday-shifts/:id/review', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, admin_note } = req.body;
    if (action !== 'Approved' && action !== 'Rejected') {
      return res.status(400).json({ error: 'Action must be "Approved" or "Rejected".' });
    }
    const shift = db.reviewHolidayShiftRequest(req.params.id, action, req.user!, admin_note);
    res.json(shift);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to process shift review.' });
  }
});

apiRouter.delete('/api/holiday-shifts/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    db.cancelHolidayShiftRequest(req.params.id, req.user!);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to cancel shift request.' });
  }
});

apiRouter.get('/api/holiday-coverage', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { upcoming_only, reference_date, country } = req.query;
    const holidays = db.getHolidays({
      upcoming_only: upcoming_only === undefined ? true : upcoming_only === 'true',
      reference_date: reference_date as string,
      country: country as string,
      is_active: true,
    });
    const coverages = holidays.map((h) => visibleCoverage(db.getHolidayStaffingCoverage(h.id), req.user!));
    res.json(coverages);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

apiRouter.get('/api/holiday-coverage/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const coverage = visibleCoverage(db.getHolidayStaffingCoverage(req.params.id), req.user!);
    res.json(coverage);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

apiRouter.post('/api/admin/holiday-conflicts/resolve', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { employee_id, holiday_date, resolution } = req.body;
    if (!employee_id || !holiday_date || !resolution) {
      return res.status(400).json({ error: 'Missing parameters for conflict resolution.' });
    }
    const result = db.resolveHolidayConflict(employee_id, holiday_date, resolution, req.user!);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to resolve conflict.' });
  }
});

// 6. Calendar
apiRouter.get('/api/calendar', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const events = db.getCalendarEvents(req.user!);
    res.json(events);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 7. Audit Logs (Admin only)
apiRouter.get('/api/audit-logs', adminOnlyMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = db.getAuditLogs();
    res.json(logs);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 8. Notifications
apiRouter.get('/api/notifications', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const notifs = db.getNotifications(req.user!.id);
    res.json(notifs);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

apiRouter.patch('/api/notifications/:id/read', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    db.markNotificationRead(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

apiRouter.post('/api/notifications/mark-all-read', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    db.markAllNotificationsRead(req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

apiRouter.delete('/api/notifications/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = db.deleteNotification(req.params.id, req.user!.id);
    res.json({ success });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

apiRouter.delete('/api/notifications', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = db.clearNotifications(req.user!.id);
    res.json({ success });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 9. Employee Documents
// Admin get all documents for an employee
apiRouter.get('/api/admin/employees/:id/documents', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const docs = db.getEmployeeDocuments(req.params.id);
    res.json(docs);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Employee get own documents
apiRouter.get('/api/my-documents', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const docs = db.getEmployeeDocuments(req.user!.id);
    res.json(docs);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

apiRouter.post('/api/admin/employees/:id/documents', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, category, file_size, file_data } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Document name is required.' });
    }
    const uploaded = decodeUpload(file_data);
    if (!db.getProfile(req.params.id)) return res.status(404).json({error: 'Employee not found.'});
    const newDoc = db.addEmployeeDocument({
      employee_id: req.params.id,
      name: name.trim(),
      category: category || 'Contract',
      file_size: `${uploaded.bytes.length} Bytes`,
      file_data,
      uploaded_by_name: req.user!.full_name,
    });
    res.status(201).json(newDoc);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to upload document.' });
  }
});

apiRouter.delete('/api/admin/employees/:employeeId/documents/:docId', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = db.deleteEmployeeDocument(req.params.employeeId, req.params.docId);
    if (!success) {
      return res.status(404).json({ error: 'Document not found.' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// --- SETTINGS ROUTES ---
apiRouter.get('/api/settings', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = db.getCompanySettings();
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.patch('/api/settings', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = db.updateCompanySettings(req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Centralized API error-handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'An internal server error occurred.' : (err.message || 'Internal Server Error'),
  });
});

// --- CLIENT SERVING VIA VITE MIDDLEWARE ---
async function start() {
  await initializeDatabase();

  if (!['production', 'test'].includes(process.env.NODE_ENV || '')) {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Server code lives outside dist; reject backend/source-map URLs explicitly.
    app.use((req, res, next) => {
      let pathname: string;
      try { pathname = decodeURIComponent(req.path); } catch { return res.sendStatus(400); }
      if (/\.(?:map|cjs)(?:$|\/)/i.test(pathname) || /^\/(?:server|build)(?:[./]|$)/i.test(pathname)) return res.sendStatus(404);
      next();
    });
    app.use('/assets', express.static(path.join(distPath, 'assets'), { index: false, fallthrough: false }));
    for (const file of ['browser-compat.js', 'logo.jpg']) {
      app.get('/' + file, (_req, res) => res.sendFile(path.join(distPath, file)));
    }
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HR Portal Server running on http://0.0.0.0:${PORT}`);
  });
}

start().catch(error => { console.error('Startup failed:', error); process.exit(1); });
