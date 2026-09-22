import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.js';
import { UserProfile } from './src/types.js';

// Extend Express Request to include authenticated user
export interface AuthenticatedRequest extends Request {
  user?: UserProfile;
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// --- PRODUCTION SECURITY HEADERS (HELMET) ---
// Note: frameguard is disabled to ensure proper rendering within the AI Studio embedded preview iframe.
app.use(
  helmet({
    frameguard: false,
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// --- RATE LIMITING DEFENSE ---
// 1. General API rate limiter: 300 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP. Please try again in 15 minutes.' },
});

// 2. Strict auth rate limiter to defend against brute-force password/identifier guessing
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts from this IP. Please wait 15 minutes before trying again.' },
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- AUTH MIDDLEWARE ---
function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  const user = db.getUserByToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
  }

  if (user.status === 'disabled') {
    return res.status(403).json({ error: 'Account disabled. Please contact HR administrator.' });
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

// 1. Auth routes
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { email, identifier, password } = req.body;
    const loginIdentifier = (identifier || email || '').trim();
    if (!loginIdentifier) {
      return res.status(400).json({ error: 'Name or email is required.' });
    }

    const authResult = db.authenticate(loginIdentifier, password);
    if (!authResult) {
      return res.status(401).json({ error: 'Invalid name, email, or credentials.' });
    }

    res.json(authResult);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Authentication failed.' });
  }
});

app.get('/api/auth/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    db.logout(token);
  }
  res.json({ success: true });
});

// 2. Profile & Leave Balances
app.get('/api/profile', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json(req.user);
});

app.get('/api/leave-balances', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
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
app.get(['/api/leave/transactions', '/api/leave-transactions'], authMiddleware, (req: AuthenticatedRequest, res: Response) => {
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
app.post('/api/admin/leave-adjustments', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
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
app.get('/api/leave-requests', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
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

app.post('/api/leave-requests', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const newRequest = db.submitLeaveRequest(req.user!, req.body);
    res.status(201).json(newRequest);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to submit leave request.' });
  }
});

app.patch('/api/leave-requests/:id/review', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
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

// 4. Employee Management
app.get('/api/employees', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const employees = db.getAllEmployees();
    if (req.user?.role !== 'admin') {
      const sanitized = employees.map((e) => ({
        ...e,
        leave_balances: [],
      }));
      return res.json(sanitized);
    }
    res.json(employees);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/employees', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = db.createEmployee(req.body, req.user!);
    res.status(201).json(profile);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create employee.' });
  }
});

app.patch('/api/employees/:id', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = db.updateEmployee(req.params.id, req.body, req.user!);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update employee.' });
  }
});

app.delete('/api/employees/:id', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    db.deleteEmployee(req.params.id, req.user!);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete employee.' });
  }
});

app.patch('/api/employees/:id/leave-balance', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
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
app.get('/api/holidays', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
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

app.post('/api/holidays', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const holiday = db.addHoliday(req.body, req.user!);
    res.status(201).json(holiday);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to add holiday.' });
  }
});

app.patch('/api/holidays/:id', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const holiday = db.updateHoliday(req.params.id, req.body, req.user!);
    res.json(holiday);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update holiday.' });
  }
});

app.patch('/api/holidays/:id/toggle-active', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const holiday = db.toggleHolidayActive(req.params.id, req.user!);
    res.json(holiday);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to toggle holiday active status.' });
  }
});

app.delete('/api/holidays/:id', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    db.deleteHoliday(req.params.id, req.user!);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete holiday.' });
  }
});

// Holiday Shift Requests & Coverage
app.get('/api/holiday-shifts', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { holiday_id, holiday_date, status, employee_id } = req.query;
    // Non-admin can only filter their own if employee_id is specified, or view shifts for a holiday
    const targetEmployeeId = req.user?.role === 'admin' ? (employee_id as string) : undefined;
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

app.post('/api/holiday-shifts', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const shift = db.submitHolidayShiftRequest(req.user!, req.body);
    res.status(201).json(shift);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to submit shift request.' });
  }
});

app.post('/api/admin/holiday-shifts/assign', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const shift = db.assignHolidayShift(req.user!, req.body);
    res.status(201).json(shift);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to assign holiday shift.' });
  }
});

app.patch('/api/holiday-shifts/:id/review', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
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

app.delete('/api/holiday-shifts/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    db.cancelHolidayShiftRequest(req.params.id, req.user!);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to cancel shift request.' });
  }
});

app.get('/api/holiday-coverage', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { upcoming_only, reference_date, country } = req.query;
    const holidays = db.getHolidays({
      upcoming_only: upcoming_only === undefined ? true : upcoming_only === 'true',
      reference_date: reference_date as string,
      country: country as string,
      is_active: true,
    });
    const coverages = holidays.map((h) => db.getHolidayStaffingCoverage(h.id));
    res.json(coverages);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/holiday-coverage/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const coverage = db.getHolidayStaffingCoverage(req.params.id);
    res.json(coverage);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/holiday-conflicts/resolve', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
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
app.get('/api/calendar', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const events = db.getCalendarEvents(req.user!);
    res.json(events);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 7. Audit Logs (Admin only)
app.get('/api/audit-logs', adminOnlyMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = db.getAuditLogs();
    res.json(logs);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 8. Notifications
app.get('/api/notifications', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const notifs = db.getNotifications(req.user!.id);
    res.json(notifs);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/notifications/:id/read', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    db.markNotificationRead(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/notifications/mark-all-read', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    db.markAllNotificationsRead(req.user!.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 9. Employee Documents
// Admin get all documents for an employee
app.get('/api/admin/employees/:id/documents', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const docs = db.getEmployeeDocuments(req.params.id);
    res.json(docs);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Employee get own documents
app.get('/api/my-documents', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const docs = db.getEmployeeDocuments(req.user!.id);
    res.json(docs);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/employees/:id/documents', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, category, file_size, file_data } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Document name is required.' });
    }
    const newDoc = db.addEmployeeDocument({
      employee_id: req.params.id,
      name,
      category: category || 'Contract',
      file_size: file_size || '1.2 MB',
      file_data,
      uploaded_by_name: req.user!.full_name,
    });
    res.status(201).json(newDoc);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/admin/employees/:employeeId/documents/:docId', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
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
app.get('/api/settings', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = db.getCompanySettings();
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/settings', adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
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
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HR Portal Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
