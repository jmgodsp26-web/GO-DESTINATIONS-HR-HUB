// src/components/dashboard/TeamCelebrations.tsx
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Award, Cake, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Heart, PartyPopper, Pause, Play, Sparkles } from "lucide-react";

// src/services/readCache.ts
function createReadCache(now = () => Date.now()) {
  let generation = 0;
  let identity = 0;
  const values = /* @__PURE__ */ new Map();
  const pending = /* @__PURE__ */ new Map();
  return {
    clear() {
      generation++;
      values.clear();
      pending.clear();
    },
    reset() {
      identity++;
      generation++;
      values.clear();
      pending.clear();
    },
    async read(key, load, ttl = 0) {
      const cached = values.get(key);
      if (cached && cached.expires > now()) return structuredClone(cached.value);
      values.delete(key);
      let promise = pending.get(key);
      if (!promise) {
        const version = generation;
        const owner = identity;
        promise = load().then((value) => {
          if (identity !== owner) throw new Error("Your sign-in changed while loading. Please refresh this page.");
          if (ttl > 0 && generation === version) {
            if (values.size >= 20) values.delete(values.keys().next().value);
            values.set(key, { value: structuredClone(value), expires: now() + ttl });
          }
          return value;
        });
        pending.set(key, promise);
      }
      try {
        return structuredClone(await promise);
      } finally {
        if (pending.get(key) === promise) pending.delete(key);
      }
    }
  };
}

// src/services/api.ts
try {
  localStorage.removeItem("hr_portal_auth_token");
  sessionStorage.removeItem("hr_portal_auth_token");
} catch {
}
var reads = createReadCache();
if (typeof window !== "undefined") {
  window.addEventListener("auth:expired", () => reads.reset());
  window.addEventListener("focus", () => reads.clear());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) reads.clear();
  });
}
async function send(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers
  };
  const response = await fetch(endpoint, {
    ...options,
    credentials: "same-origin",
    headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      reads.reset();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:expired", { detail: { message: data.error } }));
      }
    }
    throw new Error(data.error || "An unexpected error occurred. Please try again.");
  }
  return data;
}
async function request(endpoint, options = {}) {
  if ((options.method || "GET").toUpperCase() === "GET") {
    return reads.read(endpoint, () => send(endpoint, options), endpoint.startsWith("/api/dashboard/") ? 5e3 : 0);
  }
  const authentication = /^\/api\/auth\/(login|logout|change-password)$/.test(endpoint);
  if (authentication) reads.reset();
  else reads.clear();
  try {
    return await send(endpoint, options);
  } finally {
    if (authentication) reads.reset();
    else reads.clear();
  }
}
var api = {
  invalidateReadCache() {
    reads.clear();
  },
  getPersonalDashboard() {
    return request("/api/dashboard/personal");
  },
  getAdministrationDashboard() {
    return request("/api/dashboard/administration");
  },
  getOnboardingSummary() {
    return request("/api/onboarding/summary");
  },
  getOnboardingTemplates() {
    return request("/api/onboarding/templates");
  },
  saveOnboardingTemplate(input, existing) {
    return request("/api/onboarding/templates" + (existing ? "/" + existing.id : ""), { method: existing ? "PATCH" : "POST", body: JSON.stringify({ ...input, ...existing ? { expected_revision: existing.revision } : {} }) });
  },
  archiveOnboardingTemplate(t) {
    return request(`/api/onboarding/templates/${t.id}/archive`, { method: "POST", body: JSON.stringify({ expected_revision: t.revision }) });
  },
  getOnboardingPlans(manage = false) {
    return request("/api/onboarding/plans" + (manage ? "?view=manage" : ""));
  },
  getOnboardingPlan(id, manage = false) {
    return request("/api/onboarding/plans/" + encodeURIComponent(id) + (manage ? "?view=manage" : ""));
  },
  assignOnboarding(input) {
    return request("/api/onboarding/plans", { method: "POST", body: JSON.stringify(input) });
  },
  updateOnboarding(p, input) {
    return request(`/api/onboarding/plans/${p.id}`, { method: "PATCH", body: JSON.stringify({ ...input, expected_revision: p.revision }) });
  },
  onboardingPlanAction(p, action, note = "") {
    return request(`/api/onboarding/plans/${p.id}/actions/${action}`, { method: "POST", body: JSON.stringify({ expected_revision: p.revision, note }) });
  },
  onboardingTaskAction(p, task, action, data = {}, manage = false) {
    return request(`/api/onboarding/plans/${p.id}/tasks/${encodeURIComponent(task)}/actions/${action}` + (manage ? "?view=manage" : ""), { method: "POST", body: JSON.stringify({ ...data, expected_revision: p.revision }) });
  },
  getAllDocuments() {
    return request("/api/documents?scope=all");
  },
  previewAnnouncementAudience(departments, countries) {
    return request("/api/announcements/audience-preview", { method: "POST", body: JSON.stringify({ departments, countries }) });
  },
  getAnnouncements(manage = false) {
    return request("/api/announcements" + (manage ? "?view=manage" : ""));
  },
  saveAnnouncement(data, existing) {
    return request("/api/announcements" + (existing ? "/" + encodeURIComponent(existing.id) : ""), {
      method: existing ? "PATCH" : "POST",
      body: JSON.stringify({ ...data, ...existing ? { expected_revision: existing.revision } : {} })
    });
  },
  archiveAnnouncement(item) {
    return request(`/api/announcements/${encodeURIComponent(item.id)}/archive`, { method: "POST", body: JSON.stringify({ expected_revision: item.revision }) });
  },
  readAnnouncement(item, acknowledge = false) {
    return request(`/api/announcements/${encodeURIComponent(item.id)}/${acknowledge ? "acknowledge" : "read"}`, { method: "POST", body: JSON.stringify({ revision: item.revision }) });
  },
  announcementReport(id) {
    return request(`/api/announcements/${encodeURIComponent(id)}/report`);
  },
  // Auth
  async login(identifier, passwordHash) {
    const res = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, email: identifier, password: passwordHash || "" })
    });
    return res;
  },
  async getMe() {
    return request("/api/auth/me");
  },
  async logout() {
    await request("/api/auth/logout", { method: "POST" });
  },
  async changePassword(currentPassword, newPassword) {
    const result = await request("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
    });
    window.dispatchEvent(new CustomEvent("auth:expired"));
    return result;
  },
  // Profile & Balances
  async getProfile() {
    return request("/api/profile");
  },
  async getLeaveBalances(employeeId) {
    const query = employeeId ? `?employee_id=${encodeURIComponent(employeeId)}` : "";
    return request(`/api/leave-balances${query}`);
  },
  async getLeaveTransactions(employeeId) {
    const query = employeeId ? `?employee_id=${encodeURIComponent(employeeId)}` : "";
    return request(`/api/leave-transactions${query}`);
  },
  async manualLeaveAdjustment(data) {
    return request(
      "/api/admin/leave-adjustments",
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    );
  },
  // Leave Requests
  async getLeaveRequests(filters) {
    const params = new URLSearchParams();
    if (filters?.scope) params.append("scope", filters.scope);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.employee) params.append("employee", filters.employee);
    if (filters?.leave_type) params.append("leave_type", filters.leave_type);
    if (filters?.date) params.append("date", filters.date);
    const query = params.toString() ? `?${params.toString()}` : "";
    return request(`/api/leave-requests${query}`);
  },
  async submitLeaveRequest(data) {
    return request("/api/leave-requests", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },
  async reviewLeaveRequest(requestId, action, admin_note) {
    return request(`/api/leave-requests/${requestId}/review`, {
      method: "PATCH",
      body: JSON.stringify({ action, admin_note })
    });
  },
  // Employee Management (Admin)
  async getAllEmployees() {
    return request("/api/employees");
  },
  async getCelebrations() {
    return request("/api/celebrations");
  },
  async reactToCelebration(celebration_id, emoji) {
    return request("/api/celebrations/reaction", { method: "POST", body: JSON.stringify({ celebration_id, emoji }) });
  },
  async setBirthdayVisibility(employee_id, visible) {
    return request("/api/celebrations/visibility", { method: "PATCH", body: JSON.stringify({ employee_id, visible }) });
  },
  async importEmployees(employees, password) {
    return request("/api/employees/import", { method: "POST", body: JSON.stringify({ employees, password }) });
  },
  async createEmployee(data) {
    return request("/api/employees", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },
  async updateEmployee(id, updates) {
    return request(`/api/employees/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates)
    });
  },
  async deleteEmployee(id) {
    return request(`/api/employees/${id}`, {
      method: "DELETE"
    });
  },
  async adjustLeaveBalance(employeeId, leave_type, allocated_days, historical_usage) {
    return request(`/api/employees/${employeeId}/leave-balance`, {
      method: "PATCH",
      body: JSON.stringify({ leave_type, allocated_days, historical_usage })
    });
  },
  // Holidays & Staff Coverage
  async getHolidays(filters) {
    const params = new URLSearchParams();
    if (filters?.country && filters.country !== "All") params.append("country", filters.country);
    if (filters?.year && filters.year !== "All") params.append("year", filters.year);
    if (filters?.holiday_type && filters.holiday_type !== "All") params.append("holiday_type", filters.holiday_type);
    if (filters?.scope && filters.scope !== "All") params.append("scope", filters.scope);
    if (filters?.is_active !== void 0) params.append("is_active", String(filters.is_active));
    if (filters?.upcoming_only) params.append("upcoming_only", "true");
    if (filters?.reference_date) params.append("reference_date", filters.reference_date);
    const query = params.toString() ? `?${params.toString()}` : "";
    return request(`/api/holidays${query}`);
  },
  async addHoliday(data) {
    return request("/api/holidays", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },
  async updateHoliday(id, data) {
    return request(`/api/holidays/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
  },
  async toggleHolidayActive(id) {
    return request(`/api/holidays/${id}/toggle-active`, {
      method: "PATCH"
    });
  },
  async deleteHoliday(id) {
    return request(`/api/holidays/${id}`, {
      method: "DELETE"
    });
  },
  async getHolidayShifts(filters) {
    const params = new URLSearchParams();
    if (filters?.holiday_id) params.append("holiday_id", filters.holiday_id);
    if (filters?.holiday_date) params.append("holiday_date", filters.holiday_date);
    if (filters?.employee_id) params.append("employee_id", filters.employee_id);
    if (filters?.status) params.append("status", filters.status);
    const query = params.toString() ? `?${params.toString()}` : "";
    return request(`/api/holiday-shifts${query}`);
  },
  async submitHolidayShift(data) {
    return request("/api/holiday-shifts", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },
  async assignHolidayShift(data) {
    return request("/api/admin/holiday-shifts/assign", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },
  async reviewHolidayShift(requestId, action, admin_note) {
    return request(`/api/holiday-shifts/${requestId}/review`, {
      method: "PATCH",
      body: JSON.stringify({ action, admin_note })
    });
  },
  async cancelHolidayShift(requestId) {
    return request(`/api/holiday-shifts/${requestId}`, {
      method: "DELETE"
    });
  },
  async deleteHolidayShift(requestId) {
    return request(`/api/holiday-shifts/${requestId}`, {
      method: "DELETE"
    });
  },
  async cancelLeaveRequest(requestId) {
    return request(`/api/leave-requests/${encodeURIComponent(requestId)}/cancel`, {
      method: "PATCH"
    });
  },
  async getAllHolidayCoverage(filters) {
    const params = new URLSearchParams();
    if (filters?.view) params.append("view", filters.view);
    if (filters?.upcoming_only !== void 0) params.append("upcoming_only", String(filters.upcoming_only));
    if (filters?.country && filters.country !== "All") params.append("country", filters.country);
    if (filters?.reference_date) params.append("reference_date", filters.reference_date);
    const query = params.toString() ? `?${params.toString()}` : "";
    return request(`/api/holiday-coverage${query}`);
  },
  async getHolidayCoverageById(holidayId) {
    return request(`/api/holiday-coverage/${holidayId}`);
  },
  async resolveHolidayConflict(employee_id, holiday_date, resolution) {
    return request("/api/admin/holiday-conflicts/resolve", {
      method: "POST",
      body: JSON.stringify({ employee_id, holiday_date, resolution })
    });
  },
  // Calendar
  async getCalendarEvents(personal = false) {
    return request("/api/calendar" + (personal ? "?view=personal" : ""));
  },
  // Audit Logs (Admin)
  async getAuditLogs() {
    return request("/api/audit-logs");
  },
  // Notifications
  async getNotifications() {
    return request("/api/notifications");
  },
  async markNotificationRead(id) {
    await request(`/api/notifications/${id}/read`, { method: "PATCH" });
  },
  async markAllNotificationsRead() {
    await request("/api/notifications/mark-all-read", { method: "POST" });
  },
  async deleteNotification(id) {
    return request(`/api/notifications/${id}`, {
      method: "DELETE"
    });
  },
  async clearNotifications() {
    return request("/api/notifications", {
      method: "DELETE"
    });
  },
  // Employee Documents
  async getMyDocuments() {
    return request("/api/documents");
  },
  async getEmployeeDocuments(employeeId) {
    return request(`/api/documents?employee=${encodeURIComponent(employeeId)}`);
  },
  async uploadEmployeeDocument(employeeId, data) {
    return request(`/api/admin/employees/${employeeId}/documents`, {
      method: "POST",
      body: JSON.stringify(data)
    });
  },
  async deleteEmployeeDocument(employeeId, docId) {
    return request(`/api/admin/employees/${employeeId}/documents/${docId}`, {
      method: "DELETE"
    });
  },
  // Company Settings
  async getSettings() {
    return request("/api/settings");
  },
  async updateSettings(updates) {
    return request("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(updates)
    });
  }
};

// src/utils/celebrations.ts
function goAnniversaryLabel(years) {
  if (!Number.isInteger(years) || years < 1) return "GO Anniversary";
  const lastTwo = years % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[years % 10] || "th";
  return `${years}${suffix} GO Anniversary`;
}

// src/components/dashboard/TeamCelebrations.tsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var reactionNames = { "\u{1F389}": "Celebrate", "\u{1F382}": "Birthday cake", "\u2764\uFE0F": "Love", "\u{1F44F}": "Applause" };
var dateFormatter = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
var monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
var dateValue = (value) => /* @__PURE__ */ new Date(`${value}T12:00:00Z`);
var displayDate = (value) => dateFormatter.format(dateValue(value));
var when = (days) => days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
function CelebrationArt({ birthday }) {
  const id = useId();
  return /* @__PURE__ */ jsxs("div", { className: "go-celebration-art", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("div", { className: "go-celebration-halo" }),
    /* @__PURE__ */ jsxs("svg", { className: "go-celebration-illustration", viewBox: "0 0 240 220", fill: "none", focusable: "false", children: [
      /* @__PURE__ */ jsxs("defs", { children: [
        /* @__PURE__ */ jsxs("linearGradient", { id: `${id}-cake`, x1: "64", y1: "100", x2: "180", y2: "180", gradientUnits: "userSpaceOnUse", children: [
          /* @__PURE__ */ jsx("stop", { stopColor: "#F4B56C" }),
          /* @__PURE__ */ jsx("stop", { offset: "1", stopColor: "#ED9027" })
        ] }),
        /* @__PURE__ */ jsxs("linearGradient", { id: `${id}-ribbon`, x1: "70", y1: "60", x2: "175", y2: "180", gradientUnits: "userSpaceOnUse", children: [
          /* @__PURE__ */ jsx("stop", { stopColor: "#7087A3" }),
          /* @__PURE__ */ jsx("stop", { offset: "1", stopColor: "#3A5D83" })
        ] }),
        /* @__PURE__ */ jsxs("linearGradient", { id: `${id}-medal`, x1: "80", y1: "50", x2: "150", y2: "135", gradientUnits: "userSpaceOnUse", children: [
          /* @__PURE__ */ jsx("stop", { stopColor: "#FFF1CA" }),
          /* @__PURE__ */ jsx("stop", { offset: "1", stopColor: "#ED9027" })
        ] })
      ] }),
      /* @__PURE__ */ jsx("ellipse", { cx: "120", cy: "190", rx: "76", ry: "12", fill: birthday ? "#D49A5E" : "#7087A3", opacity: ".16" }),
      birthday ? /* @__PURE__ */ jsxs("g", { className: "go-celebration-float", children: [
        /* @__PURE__ */ jsx("ellipse", { cx: "120", cy: "176", rx: "80", ry: "14", fill: "#FFF", stroke: "#F1DCC6", strokeWidth: "2" }),
        /* @__PURE__ */ jsx("path", { d: "M56 119H184V162C184 180 56 180 56 162V119Z", fill: `url(#${id}-cake)` }),
        /* @__PURE__ */ jsx("path", { d: "M56 146C84 160 156 160 184 146", stroke: "#FFE5C9", strokeWidth: "7" }),
        /* @__PURE__ */ jsx("ellipse", { cx: "120", cy: "119", rx: "64", ry: "19", fill: "#FFFBF4" }),
        /* @__PURE__ */ jsx("path", { d: "M56 119V132C56 143 73 143 73 132V129C73 126 81 126 81 130V138C81 151 99 151 99 138V135C99 130 108 130 108 135V143C108 155 126 155 126 143V137C126 133 134 133 134 137C134 148 152 148 152 137V130C152 125 160 125 160 130C160 144 184 141 184 130V119C172 140 68 140 56 119Z", fill: "#FFFBF4" }),
        /* @__PURE__ */ jsx("rect", { x: "89", y: "79", width: "9", height: "37", rx: "4", fill: "#7087A3" }),
        /* @__PURE__ */ jsx("path", { d: "M90 89L97 83M90 102L97 96", stroke: "#CFD7E1", strokeWidth: "3" }),
        /* @__PURE__ */ jsx("rect", { x: "116", y: "66", width: "9", height: "47", rx: "4", fill: "#ED9027" }),
        /* @__PURE__ */ jsx("path", { d: "M117 79L124 73M117 93L124 87", stroke: "#FFF0D9", strokeWidth: "3" }),
        /* @__PURE__ */ jsx("rect", { x: "143", y: "79", width: "9", height: "37", rx: "4", fill: "#7087A3" }),
        /* @__PURE__ */ jsx("path", { d: "M144 89L151 83M144 102L151 96", stroke: "#CFD7E1", strokeWidth: "3" }),
        /* @__PURE__ */ jsxs("g", { className: "go-celebration-flames", fill: "#ED9027", children: [
          /* @__PURE__ */ jsx("path", { d: "M93 77C80 71 91 61 94 56C98 64 104 73 93 77Z" }),
          /* @__PURE__ */ jsx("path", { d: "M120 64C107 58 118 48 121 43C125 51 131 60 120 64Z" }),
          /* @__PURE__ */ jsx("path", { d: "M147 77C134 71 145 61 148 56C152 64 158 73 147 77Z" })
        ] }),
        /* @__PURE__ */ jsx("path", { d: "M79 116L85 118M154 117L160 114M110 124L116 125M134 118L139 116", stroke: "#ED9027", strokeWidth: "3", strokeLinecap: "round" })
      ] }) : /* @__PURE__ */ jsxs("g", { className: "go-celebration-float", children: [
        /* @__PURE__ */ jsx("path", { d: "M85 111L67 175L93 165L108 186L124 123L85 111Z", fill: `url(#${id}-ribbon)` }),
        /* @__PURE__ */ jsx("path", { d: "M154 111L173 175L147 165L132 186L116 123L154 111Z", fill: "#3A5D83" }),
        /* @__PURE__ */ jsx("circle", { cx: "120", cy: "96", r: "55", fill: `url(#${id}-medal)`, stroke: "#ED9027", strokeWidth: "3" }),
        /* @__PURE__ */ jsx("circle", { cx: "120", cy: "96", r: "43", stroke: "#FFFAE9", strokeWidth: "3" }),
        /* @__PURE__ */ jsx("path", { d: "M120 65L129 84L150 87L135 102L138 123L120 113L102 123L105 102L90 87L111 84L120 65Z", fill: "#FFF9E8", stroke: "#CD7A19", strokeWidth: "2", strokeLinejoin: "round" }),
        /* @__PURE__ */ jsx("path", { d: "M81 61L85 58M155 133L159 130", stroke: "#FFF", strokeWidth: "3", strokeLinecap: "round" })
      ] })
    ] }),
    /* @__PURE__ */ jsx("span", { className: "go-celebration-spark go-celebration-spark-one", children: /* @__PURE__ */ jsx(Sparkles, { size: 22 }) }),
    /* @__PURE__ */ jsx("span", { className: "go-celebration-spark go-celebration-spark-two", children: /* @__PURE__ */ jsx(Sparkles, { size: 15 }) }),
    /* @__PURE__ */ jsx("span", { className: "go-celebration-confetti go-celebration-confetti-one" }),
    /* @__PURE__ */ jsx("span", { className: "go-celebration-confetti go-celebration-confetti-two" }),
    /* @__PURE__ */ jsx("span", { className: "go-celebration-confetti go-celebration-confetti-three" })
  ] });
}
function CelebrationSpotlight({ item, busy, peopleOpen, onReact, onTogglePeople }) {
  const birthday = item.type === "birthday", today = item.days_until === 0;
  const total = item.reactions.reduce((sum, r) => sum + r.people.length, 0);
  const peopleId = useId();
  return /* @__PURE__ */ jsxs("article", { className: `go-celebration-spotlight is-${birthday ? "birthday" : "anniversary"}${today ? " is-today" : ""}`, "aria-label": `${item.name}, ${birthday ? "birthday" : "work anniversary"}, ${when(item.days_until)}`, children: [
    /* @__PURE__ */ jsxs("div", { className: "go-celebration-copy", children: [
      /* @__PURE__ */ jsxs("div", { className: "go-celebration-kicker", children: [
        /* @__PURE__ */ jsxs("span", { className: "go-celebration-badge", children: [
          today ? /* @__PURE__ */ jsx(Sparkles, { size: 14, "aria-hidden": "true" }) : /* @__PURE__ */ jsx(CalendarDays, { size: 14, "aria-hidden": "true" }),
          today ? "Celebrating today" : "Coming up"
        ] }),
        !today && /* @__PURE__ */ jsx("span", { children: when(item.days_until) })
      ] }),
      /* @__PURE__ */ jsx("h3", { className: "go-celebration-title", children: birthday ? today ? /* @__PURE__ */ jsxs(Fragment, { children: [
        "It\u2019s ",
        /* @__PURE__ */ jsxs("span", { children: [
          item.name,
          "\u2019s"
        ] }),
        /* @__PURE__ */ jsx("br", {}),
        "birthday today!"
      ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        "Upcoming birthday:",
        /* @__PURE__ */ jsx("br", {}),
        /* @__PURE__ */ jsx("span", { children: item.name })
      ] }) : today ? /* @__PURE__ */ jsxs(Fragment, { children: [
        "Happy ",
        goAnniversaryLabel(item.years),
        "!",
        /* @__PURE__ */ jsx("br", {}),
        /* @__PURE__ */ jsx("span", { children: item.name })
      ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        "Upcoming ",
        goAnniversaryLabel(item.years),
        ":",
        /* @__PURE__ */ jsx("br", {}),
        /* @__PURE__ */ jsx("span", { children: item.name })
      ] }) }, `${item.id}-title`),
      /* @__PURE__ */ jsx("p", { className: "go-celebration-message", children: birthday ? today ? "Your GO team wishes you a wonderful birthday!" : "A special day is on the way. Let\u2019s celebrate together!" : today ? `Celebrating ${item.years} ${item.years === 1 ? "year" : "years"} with GO. Thank you for everything you do!` : `${item.years} ${item.years === 1 ? "year" : "years"} with GO on ${displayDate(item.date)}. A milestone worth celebrating!` }),
      /* @__PURE__ */ jsxs("div", { className: "go-celebration-date-line", children: [
        birthday ? /* @__PURE__ */ jsx(Cake, { size: 17, "aria-hidden": "true" }) : /* @__PURE__ */ jsx(Award, { size: 17, "aria-hidden": "true" }),
        /* @__PURE__ */ jsxs("span", { children: [
          displayDate(item.date),
          /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: " \xB7 " }),
          birthday ? "Birthday" : "Work anniversary"
        ] })
      ] }),
      today ? /* @__PURE__ */ jsxs("div", { className: "go-celebration-reactions", children: [
        /* @__PURE__ */ jsx("p", { className: "go-celebration-reaction-prompt", children: "Send a little celebration" }),
        /* @__PURE__ */ jsx("div", { className: "go-celebration-reaction-buttons", role: "group", "aria-label": "Celebration reactions", "aria-busy": busy, children: item.reactions.map((r) => /* @__PURE__ */ jsxs("button", { type: "button", disabled: busy, "aria-label": `${reactionNames[r.emoji] || r.emoji}, ${r.people.length} ${r.people.length === 1 ? "reaction" : "reactions"}`, "aria-pressed": item.my_reaction === r.emoji, onClick: () => onReact(r.emoji), children: [
          /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: r.emoji }),
          /* @__PURE__ */ jsx("span", { children: r.people.length })
        ] }, r.emoji)) }),
        total > 0 ? /* @__PURE__ */ jsxs("button", { type: "button", className: "go-celebration-people-toggle", onClick: onTogglePeople, "aria-expanded": peopleOpen, "aria-controls": peopleId, children: [
          /* @__PURE__ */ jsx(Heart, { size: 13, "aria-hidden": "true" }),
          total,
          " ",
          total === 1 ? "teammate has" : "teammates have",
          " celebrated",
          /* @__PURE__ */ jsx(ChevronDown, { size: 14, "aria-hidden": "true" })
        ] }) : /* @__PURE__ */ jsx("p", { className: "go-celebration-first", children: "Be the first to celebrate!" }),
        peopleOpen && total > 0 && /* @__PURE__ */ jsx("ul", { className: "go-celebration-people", id: peopleId, "aria-label": "Who reacted", children: item.reactions.filter((r) => r.people.length > 0).map((r) => /* @__PURE__ */ jsxs("li", { children: [
          /* @__PURE__ */ jsx("span", { "aria-label": reactionNames[r.emoji], children: r.emoji }),
          /* @__PURE__ */ jsx("span", { children: r.people.map((p) => p.name).join(", ") })
        ] }, r.emoji)) })
      ] }) : /* @__PURE__ */ jsxs("p", { className: "go-celebration-reminder", children: [
        /* @__PURE__ */ jsx(Heart, { size: 14, "aria-hidden": "true" }),
        "Send your reactions on the day."
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "go-celebration-scene", children: [
      /* @__PURE__ */ jsxs("div", { className: "go-celebration-date-stamp", "aria-hidden": "true", children: [
        /* @__PURE__ */ jsx("span", { children: monthFormatter.format(dateValue(item.date)) }),
        /* @__PURE__ */ jsx("strong", { children: Number(item.date.slice(8, 10)) }),
        /* @__PURE__ */ jsx("small", { children: when(item.days_until) })
      ] }),
      /* @__PURE__ */ jsx(CelebrationArt, { birthday }),
      /* @__PURE__ */ jsx("span", { className: "go-celebration-scene-caption", "aria-hidden": "true", children: birthday ? today ? "Make a wish!" : "A little joy, coming soon" : today ? "Here\u2019s to you!" : "Another year of great work" })
    ] })
  ] });
}
function TeamCelebrations() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [upcoming, setUpcoming] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [manualPause, setManualPause] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [busy, setBusy] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const requestVersion = useRef(0), mutationPending = useRef(false);
  const upcomingId = useId();
  const load = useCallback(async () => {
    if (document.hidden || mutationPending.current) return;
    const version = ++requestVersion.current;
    try {
      const next = await api.getCelebrations();
      if (version === requestVersion.current) {
        setData(next);
        setError("");
      }
    } catch {
      if (version === requestVersion.current) setError("Celebrations could not refresh. Please try again.");
    }
  }, []);
  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 6e4);
    const refresh = () => {
      setVisible(!document.hidden);
      if (!document.hidden) void load();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionChanged = () => setReducedMotion(media.matches);
    motionChanged();
    media.addEventListener("change", motionChanged);
    return () => {
      clearInterval(interval);
      ++requestVersion.current;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      media.removeEventListener("change", motionChanged);
    };
  }, [load]);
  const items = data?.items || [], item = items[index % Math.max(1, items.length)];
  const todayCount = items.filter((i) => i.days_until === 0).length;
  const motionPaused = manualPause || reducedMotion || !visible;
  useEffect(() => {
    if (items.length < 2 || motionPaused || hovered || focused || upcoming || peopleOpen || busy) return;
    const interval = setInterval(() => setIndex((i) => i + 1), 8e3);
    return () => clearInterval(interval);
  }, [items.length, motionPaused, hovered, focused, upcoming, peopleOpen, busy]);
  function select(next) {
    setIndex(next);
    setPeopleOpen(false);
  }
  async function react(emoji) {
    if (!item || mutationPending.current) return;
    mutationPending.current = true;
    setBusy(true);
    const version = ++requestVersion.current;
    try {
      const next = await api.reactToCelebration(item.id, item.my_reaction === emoji ? null : emoji);
      if (version === requestVersion.current) {
        setData(next);
        setError("");
      }
    } catch (e) {
      if (version === requestVersion.current) setError(e instanceof Error ? e.message : "Your reaction could not be saved. Please try again.");
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsxs("section", { "aria-label": "Team celebrations", className: `go-team-celebrations${motionPaused ? " is-motion-paused" : ""}`, onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false), onFocusCapture: () => setFocused(true), onBlurCapture: (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
  }, children: [
    /* @__PURE__ */ jsxs("header", { className: "go-celebration-header", children: [
      /* @__PURE__ */ jsxs("div", { className: "go-celebration-heading", children: [
        /* @__PURE__ */ jsx("span", { className: "go-celebration-heading-icon", children: /* @__PURE__ */ jsx(PartyPopper, { size: 20, "aria-hidden": "true" }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h2", { children: "Team celebrations" }),
          /* @__PURE__ */ jsx("p", { children: "Birthdays & work anniversaries" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "go-celebration-header-actions", children: [
        todayCount > 0 && /* @__PURE__ */ jsxs("span", { className: "go-celebration-today-count", children: [
          todayCount,
          " today"
        ] }),
        /* @__PURE__ */ jsxs("button", { type: "button", className: "go-celebration-week-toggle", "aria-expanded": upcoming, "aria-controls": upcomingId, onClick: () => setUpcoming((v) => !v), children: [
          upcoming ? "Hide upcoming" : "View next 7 days",
          /* @__PURE__ */ jsx(ChevronDown, { size: 16, "aria-hidden": "true" })
        ] }),
        item && /* @__PURE__ */ jsx("button", { type: "button", className: "go-celebration-icon-button go-celebration-motion-toggle", "aria-label": manualPause ? "Play celebration animation" : "Pause celebration animation", title: manualPause ? "Play animation" : "Pause animation", "aria-pressed": manualPause, onClick: () => setManualPause((v) => !v), children: manualPause ? /* @__PURE__ */ jsx(Play, { size: 14, "aria-hidden": "true" }) : /* @__PURE__ */ jsx(Pause, { size: 14, "aria-hidden": "true" }) })
      ] })
    ] }),
    error && /* @__PURE__ */ jsxs("div", { role: "alert", className: "go-celebration-error", children: [
      error,
      /* @__PURE__ */ jsx("button", { type: "button", onClick: () => void load(), children: "Retry" })
    ] }),
    !data && !error && /* @__PURE__ */ jsx("p", { role: "status", className: "go-celebration-empty", children: "Loading celebrations\u2026" }),
    item ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(CelebrationSpotlight, { item, busy, peopleOpen, onReact: (emoji) => void react(emoji), onTogglePeople: () => setPeopleOpen((v) => !v) }),
      items.length > 1 && /* @__PURE__ */ jsxs("nav", { className: "go-celebration-navigation", "aria-label": "Browse celebrations", children: [
        /* @__PURE__ */ jsx("span", { children: "More moments to celebrate" }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("button", { type: "button", className: "go-celebration-icon-button", disabled: busy, "aria-label": "Previous celebration", onClick: () => select((index + items.length - 1) % items.length), children: /* @__PURE__ */ jsx(ChevronLeft, { size: 18, "aria-hidden": "true" }) }),
          /* @__PURE__ */ jsxs("span", { "aria-live": "off", children: [
            index % items.length + 1,
            " / ",
            items.length
          ] }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "go-celebration-icon-button", disabled: busy, "aria-label": "Next celebration", onClick: () => select(index + 1), children: /* @__PURE__ */ jsx(ChevronRight, { size: 18, "aria-hidden": "true" }) })
        ] })
      ] })
    ] }) : data && /* @__PURE__ */ jsxs("div", { className: "go-celebration-empty", children: [
      /* @__PURE__ */ jsx(Sparkles, { size: 24, "aria-hidden": "true" }),
      /* @__PURE__ */ jsxs("p", { children: [
        "No birthdays or work anniversaries in the next 7 days.",
        /* @__PURE__ */ jsx("small", { children: "The next team celebration will appear here." })
      ] })
    ] }),
    upcoming && /* @__PURE__ */ jsxs("div", { id: upcomingId, className: "go-celebration-week", children: [
      /* @__PURE__ */ jsx("h3", { children: "The next 7 days" }),
      items.length ? /* @__PURE__ */ jsx("ul", { children: items.map((event, i) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs("button", { type: "button", disabled: busy, className: `go-celebration-week-card is-${event.type}`, "aria-label": `${event.name}, ${event.type === "birthday" ? "birthday" : "work anniversary"}, ${displayDate(event.date)}`, "aria-pressed": item?.id === event.id, onClick: () => select(i), children: [
        /* @__PURE__ */ jsx("span", { className: "go-celebration-week-icon", children: event.type === "birthday" ? /* @__PURE__ */ jsx(Cake, { size: 18, "aria-hidden": "true" }) : /* @__PURE__ */ jsx(Award, { size: 18, "aria-hidden": "true" }) }),
        /* @__PURE__ */ jsxs("span", { className: "go-celebration-week-person", children: [
          /* @__PURE__ */ jsx("strong", { children: event.name }),
          /* @__PURE__ */ jsxs("small", { children: [
            event.type === "birthday" ? "Birthday" : "Work anniversary",
            " \xB7 ",
            displayDate(event.date)
          ] })
        ] }),
        /* @__PURE__ */ jsx("span", { className: "go-celebration-week-when", children: when(event.days_until) })
      ] }) }, event.id)) }) : /* @__PURE__ */ jsx("p", { children: "No celebrations are scheduled for this week." })
    ] })
  ] });
}
export {
  CelebrationSpotlight,
  TeamCelebrations
};
