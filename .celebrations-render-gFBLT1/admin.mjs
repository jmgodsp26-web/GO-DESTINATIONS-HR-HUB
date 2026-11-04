// src/components/admin/CelebrationsWidget.tsx
import { useState, useMemo } from "react";

// src/utils/celebrations.ts
function goAnniversaryLabel(years) {
  if (!Number.isInteger(years) || years < 1) return "GO Anniversary";
  const lastTwo = years % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[years % 10] || "th";
  return `${years}${suffix} GO Anniversary`;
}

// src/components/admin/CelebrationsWidget.tsx
import {
  Cake,
  Award,
  Sparkles,
  Mail,
  Gift,
  PartyPopper,
  Clock,
  ChevronRight,
  CheckCircle2
} from "lucide-react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var CelebrationsWidget = ({
  employees,
  onNavigateTab,
  className = ""
}) => {
  const [filterType, setFilterType] = useState("all");
  const [daysRange, setDaysRange] = useState(30);
  const [wishedEmployees, setWishedEmployees] = useState({});
  const celebrations = useMemo(() => {
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();
    const items = [];
    employees.forEach((emp) => {
      const dobStr = emp.date_of_birth || emp.birthday;
      if (dobStr && dobStr.includes("-")) {
        const parts = dobStr.split("-");
        if (parts.length >= 3) {
          const birthMonth = parseInt(parts[1], 10) - 1;
          const birthDay = parseInt(parts[2], 10);
          if (!isNaN(birthMonth) && !isNaN(birthDay)) {
            let nextDob = new Date(currentYear, birthMonth, birthDay);
            nextDob.setHours(0, 0, 0, 0);
            if (nextDob.getTime() < today.getTime()) {
              nextDob = new Date(currentYear + 1, birthMonth, birthDay);
            }
            const diffTime = nextDob.getTime() - today.getTime();
            const daysUntil = Math.round(diffTime / (1e3 * 60 * 60 * 24));
            items.push({
              id: `${emp.id}-birthday`,
              employeeId: emp.id,
              employeeName: emp.full_name,
              employeeEmail: emp.email,
              employeeDepartment: emp.department,
              employeeAvatar: emp.avatar_url || "",
              employeeJobTitle: emp.job_title,
              type: "birthday",
              nextOccurrenceDate: nextDob,
              nextOccurrenceStr: nextDob.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric"
              }),
              daysUntil,
              milestoneTitle: daysUntil === 0 ? "Birthday today!" : "Upcoming birthday"
            });
          }
        }
      }
      const hireStr = emp.hire_date || emp.date_joined;
      if (hireStr && hireStr.includes("-")) {
        const parts = hireStr.split("-");
        if (parts.length >= 3) {
          const hireYear = parseInt(parts[0], 10);
          const hireMonth = parseInt(parts[1], 10) - 1;
          const hireDay = parseInt(parts[2], 10);
          if (!isNaN(hireMonth) && !isNaN(hireDay) && !isNaN(hireYear)) {
            let nextHire = new Date(currentYear, hireMonth, hireDay);
            nextHire.setHours(0, 0, 0, 0);
            if (nextHire.getTime() < today.getTime()) {
              nextHire = new Date(currentYear + 1, hireMonth, hireDay);
            }
            const diffTime = nextHire.getTime() - today.getTime();
            const daysUntil = Math.round(diffTime / (1e3 * 60 * 60 * 24));
            const completedYears = nextHire.getFullYear() - hireYear;
            if (completedYears > 0) {
              items.push({
                id: `${emp.id}-anniversary`,
                employeeId: emp.id,
                employeeName: emp.full_name,
                employeeEmail: emp.email,
                employeeDepartment: emp.department,
                employeeAvatar: emp.avatar_url || "",
                employeeJobTitle: emp.job_title,
                type: "anniversary",
                rawDate: hireStr,
                nextOccurrenceDate: nextHire,
                nextOccurrenceStr: nextHire.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric"
                }),
                daysUntil,
                yearsCount: completedYears,
                milestoneTitle: daysUntil === 0 ? `Happy ${goAnniversaryLabel(completedYears)}!` : `Upcoming ${goAnniversaryLabel(completedYears)}`
              });
            }
          }
        }
      }
    });
    return items.sort((a, b) => a.daysUntil - b.daysUntil);
  }, [employees]);
  const filteredCelebrations = useMemo(() => {
    return celebrations.filter((item) => {
      if (filterType !== "all" && item.type !== filterType) return false;
      return item.daysUntil <= daysRange;
    });
  }, [celebrations, filterType, daysRange]);
  const todayCelebrations = useMemo(() => {
    return celebrations.filter((item) => item.daysUntil === 0);
  }, [celebrations]);
  const thisMonthStats = useMemo(() => {
    const today = /* @__PURE__ */ new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const birthdaysThisMonth = celebrations.filter(
      (c) => c.type === "birthday" && c.nextOccurrenceDate.getMonth() === currentMonth && c.nextOccurrenceDate.getFullYear() === currentYear
    ).length;
    const anniversariesThisMonth = celebrations.filter(
      (c) => c.type === "anniversary" && c.nextOccurrenceDate.getMonth() === currentMonth && c.nextOccurrenceDate.getFullYear() === currentYear
    ).length;
    return { birthdaysThisMonth, anniversariesThisMonth };
  }, [celebrations]);
  const handleSendWish = (item, e) => {
    e.stopPropagation();
    setWishedEmployees((prev) => ({ ...prev, [item.id]: true }));
    const subject = item.type === "birthday" ? `Happy Birthday, ${item.employeeName.split(" ")[0]}! \u{1F382}\u{1F389}` : `Happy ${goAnniversaryLabel(item.yearsCount)}, ${item.employeeName.split(" ")[0]}! \u{1F3C6}\u{1F396}\uFE0F`;
    const body = item.type === "birthday" ? `Hi ${item.employeeName.split(" ")[0]},

Your GO team wishes you a wonderful birthday! Thank you for everything you contribute to our team.

Best regards,
HR Team` : `Hi ${item.employeeName.split(" ")[0]},

Happy ${goAnniversaryLabel(item.yearsCount)}! Thank you for your continued dedication, leadership, and impact on our team.

Best regards,
HR Team`;
    window.location.href = `mailto:${encodeURIComponent(item.employeeEmail)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      id: "admin-celebrations-widget",
      className: `bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden ${className}`,
      children: [
        /* @__PURE__ */ jsxs("div", { className: "px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center space-x-2", children: [
              /* @__PURE__ */ jsx("span", { className: "p-1 bg-amber-100 text-amber-800 rounded-md", children: /* @__PURE__ */ jsx(PartyPopper, { className: "w-4 h-4" }) }),
              /* @__PURE__ */ jsx("h2", { className: "text-sm font-bold text-slate-900", children: "Upcoming Birthdays & Work Anniversaries" }),
              todayCelebrations.length > 0 && /* @__PURE__ */ jsxs("span", { className: "px-2 py-0.5 rounded-full text-[12px] font-bold bg-rose-100 text-rose-700 border border-rose-200 animate-pulse", children: [
                todayCelebrations.length,
                " Today! \u{1F389}"
              ] })
            ] }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: "See upcoming birthdays and work anniversaries." })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center space-x-2 text-xs", children: [
            /* @__PURE__ */ jsxs("span", { className: "px-2.5 py-1 rounded-lg bg-pink-50 border border-pink-100 text-pink-700 font-medium flex items-center space-x-1 shadow-2xs", children: [
              /* @__PURE__ */ jsx(Cake, { className: "w-3.5 h-3.5 text-pink-500" }),
              /* @__PURE__ */ jsxs("span", { children: [
                thisMonthStats.birthdaysThisMonth,
                " Birthdays this mo."
              ] })
            ] }),
            /* @__PURE__ */ jsxs("span", { className: "px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-medium flex items-center space-x-1 shadow-2xs", children: [
              /* @__PURE__ */ jsx(Award, { className: "w-3.5 h-3.5 text-indigo-500" }),
              /* @__PURE__ */ jsxs("span", { children: [
                thisMonthStats.anniversariesThisMonth,
                " Anniversaries"
              ] })
            ] })
          ] })
        ] }),
        todayCelebrations.length > 0 && /* @__PURE__ */ jsxs("div", { className: "bg-gradient-to-r from-amber-500/10 via-pink-500/10 to-indigo-500/10 border-b border-amber-200/60 p-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center space-x-2 text-amber-900 font-bold text-xs uppercase tracking-wider mb-2", children: [
            /* @__PURE__ */ jsx(Sparkles, { className: "w-3.5 h-3.5 text-amber-600 animate-spin", style: { animationDuration: "3s" } }),
            /* @__PURE__ */ jsx("span", { children: "Today's Milestone Spotlight" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3", children: todayCelebrations.map((item) => /* @__PURE__ */ jsxs(
            "div",
            {
              className: "bg-white/95 backdrop-blur-xs border border-amber-200 rounded-xl p-3.5 shadow-xs flex items-center justify-between gap-3",
              children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center space-x-3 min-w-0", children: [
                  /* @__PURE__ */ jsxs("div", { className: "relative shrink-0", children: [
                    item.employeeAvatar && item.employeeAvatar.trim() ? /* @__PURE__ */ jsx(
                      "img",
                      {
                        src: item.employeeAvatar,
                        alt: item.employeeName,
                        className: "w-11 h-11 rounded-full object-cover border-2 border-amber-400 shadow-2xs"
                      }
                    ) : /* @__PURE__ */ jsx("div", { className: "w-11 h-11 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs border-2 border-amber-400 shadow-2xs", children: item.employeeName?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "GO" }),
                    /* @__PURE__ */ jsx("span", { className: "absolute -bottom-1 -right-1 text-base", children: item.type === "birthday" ? "\u{1F382}" : "\u{1F3C6}" })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center space-x-1.5", children: [
                      /* @__PURE__ */ jsx("span", { className: "font-bold text-slate-900 text-xs truncate", children: item.employeeName }),
                      /* @__PURE__ */ jsx("span", { className: "px-1.5 py-0.2 rounded text-[12px] font-bold bg-amber-100 text-amber-800 shrink-0", children: "TODAY!" })
                    ] }),
                    /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold text-indigo-700 mt-0.5 truncate", children: item.milestoneTitle }),
                    /* @__PURE__ */ jsxs("p", { className: "text-[12px] text-slate-500 truncate", children: [
                      item.employeeDepartment,
                      " \u2022 ",
                      item.employeeJobTitle
                    ] })
                  ] })
                ] }),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    id: `wish-btn-${item.id}`,
                    onClick: (e) => handleSendWish(item, e),
                    className: `px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors shadow-2xs flex items-center space-x-1.5 ${wishedEmployees[item.id] ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-700 hover:to-indigo-700 text-white"}`,
                    children: wishedEmployees[item.id] ? /* @__PURE__ */ jsxs(Fragment, { children: [
                      /* @__PURE__ */ jsx(CheckCircle2, { className: "w-3.5 h-3.5 text-emerald-600" }),
                      /* @__PURE__ */ jsx("span", { children: "Wished!" })
                    ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
                      /* @__PURE__ */ jsx(Gift, { className: "w-3.5 h-3.5" }),
                      /* @__PURE__ */ jsx("span", { children: "Send Wishes" })
                    ] })
                  }
                )
              ]
            },
            item.id
          )) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center space-x-1 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => setFilterType("all"),
                className: `px-3 py-1 text-xs font-semibold rounded-md transition-colors ${filterType === "all" ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`,
                children: [
                  "All Milestones (",
                  celebrations.length,
                  ")"
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => setFilterType("birthday"),
                className: `px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center space-x-1 ${filterType === "birthday" ? "bg-pink-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`,
                children: [
                  /* @__PURE__ */ jsx(Cake, { className: "w-3 h-3" }),
                  /* @__PURE__ */ jsxs("span", { children: [
                    "Birthdays (",
                    celebrations.filter((c) => c.type === "birthday").length,
                    ")"
                  ] })
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => setFilterType("anniversary"),
                className: `px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center space-x-1 ${filterType === "anniversary" ? "bg-amber-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`,
                children: [
                  /* @__PURE__ */ jsx(Award, { className: "w-3 h-3" }),
                  /* @__PURE__ */ jsxs("span", { children: [
                    "Anniversaries (",
                    celebrations.filter((c) => c.type === "anniversary").length,
                    ")"
                  ] })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center space-x-2", children: [
            /* @__PURE__ */ jsxs("span", { className: "text-xs text-slate-500 font-medium flex items-center space-x-1", children: [
              /* @__PURE__ */ jsx(Clock, { className: "w-3.5 h-3.5" }),
              /* @__PURE__ */ jsx("span", { children: "Timeframe:" })
            ] }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: daysRange,
                onChange: (e) => setDaysRange(parseInt(e.target.value, 10)),
                className: "text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs",
                children: [
                  /* @__PURE__ */ jsx("option", { value: 14, children: "Next 14 Days" }),
                  /* @__PURE__ */ jsx("option", { value: 30, children: "Next 30 Days" }),
                  /* @__PURE__ */ jsx("option", { value: 60, children: "Next 60 Days" }),
                  /* @__PURE__ */ jsx("option", { value: 90, children: "Next 90 Days" }),
                  /* @__PURE__ */ jsx("option", { value: 365, children: "Full Year" })
                ]
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "divide-y divide-slate-100", children: filteredCelebrations.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "p-10 text-center text-xs text-slate-500", children: [
          /* @__PURE__ */ jsx(Cake, { className: "w-8 h-8 text-slate-300 mx-auto mb-2" }),
          /* @__PURE__ */ jsx("p", { className: "font-semibold text-slate-700", children: "No upcoming celebrations found" }),
          /* @__PURE__ */ jsxs("p", { className: "text-slate-400 mt-0.5", children: [
            "No employee birthdays or work anniversaries match the selected filter within the next ",
            daysRange,
            " days."
          ] })
        ] }) : filteredCelebrations.map((item) => {
          const isToday = item.daysUntil === 0;
          const isTomorrow = item.daysUntil === 1;
          const isWithinAWeek = item.daysUntil <= 7 && item.daysUntil > 1;
          return /* @__PURE__ */ jsxs(
            "div",
            {
              className: `p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${isToday ? "bg-amber-50/40 hover:bg-amber-50/70" : "hover:bg-slate-50/80"}`,
              children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center space-x-3.5 min-w-0", children: [
                  /* @__PURE__ */ jsxs("div", { className: "relative shrink-0", children: [
                    item.employeeAvatar && item.employeeAvatar.trim() ? /* @__PURE__ */ jsx(
                      "img",
                      {
                        src: item.employeeAvatar,
                        alt: item.employeeName,
                        className: "w-10 h-10 rounded-full object-cover border border-slate-200"
                      }
                    ) : /* @__PURE__ */ jsx("div", { className: "w-10 h-10 rounded-full bg-[#3A5D83]/10 text-[#3A5D83] flex items-center justify-center font-bold text-xs border border-[#3A5D83]/20", children: item.employeeName.split(" ").map((n) => n[0]).join("").slice(0, 2) }),
                    /* @__PURE__ */ jsx("span", { className: "absolute -bottom-1 -right-1 text-xs", children: item.type === "birthday" ? "\u{1F382}" : "\u{1F396}\uFE0F" })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center space-x-2 flex-wrap", children: [
                      /* @__PURE__ */ jsx("span", { className: "font-bold text-slate-900 text-xs sm:text-sm", children: item.employeeName }),
                      /* @__PURE__ */ jsxs("span", { className: "text-xs text-slate-500", children: [
                        "(",
                        item.employeeDepartment,
                        ")"
                      ] }),
                      item.type === "birthday" ? /* @__PURE__ */ jsx("span", { className: "px-2 py-0.5 rounded-full text-[12px] font-semibold bg-pink-100 text-pink-800 border border-pink-200", children: "Birthday" }) : /* @__PURE__ */ jsx("span", { className: "px-2 py-0.5 rounded-full text-[12px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200", children: "Work Anniversary" })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center space-x-2 text-xs text-slate-600 mt-1", children: [
                      /* @__PURE__ */ jsx("span", { className: "font-semibold text-slate-900", children: item.milestoneTitle }),
                      /* @__PURE__ */ jsx("span", { className: "text-slate-300", children: "\u2022" }),
                      /* @__PURE__ */ jsx("span", { className: "text-slate-500 text-[12px]", children: item.type === "birthday" ? `Birthday on ${item.nextOccurrenceStr}` : `Hired on ${item.rawDate}` })
                    ] })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center space-x-3 self-end sm:self-center shrink-0", children: [
                  /* @__PURE__ */ jsxs("div", { className: "text-right", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center space-x-1.5 justify-end", children: [
                      /* @__PURE__ */ jsx("span", { className: "text-xs font-bold text-slate-900", children: item.nextOccurrenceStr }),
                      isToday ? /* @__PURE__ */ jsx("span", { className: "px-2 py-0.5 rounded text-[12px] font-bold bg-amber-500 text-white animate-pulse", children: "Today! \u{1F389}" }) : isTomorrow ? /* @__PURE__ */ jsx("span", { className: "px-1.5 py-0.5 rounded text-[12px] font-bold bg-purple-100 text-purple-700", children: "Tomorrow" }) : isWithinAWeek ? /* @__PURE__ */ jsxs("span", { className: "px-1.5 py-0.5 rounded text-[12px] font-bold bg-blue-100 text-blue-700", children: [
                        "In ",
                        item.daysUntil,
                        " days"
                      ] }) : /* @__PURE__ */ jsxs("span", { className: "text-[12px] text-slate-400 font-medium", children: [
                        "In ",
                        item.daysUntil,
                        " days"
                      ] })
                    ] }),
                    /* @__PURE__ */ jsx("span", { className: "block text-[12px] text-slate-400", children: item.employeeJobTitle })
                  ] }),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: (e) => handleSendWish(item, e),
                      title: `Send celebration wish to ${item.employeeName}`,
                      className: `p-2 rounded-lg text-xs font-semibold transition-colors shadow-2xs border ${wishedEmployees[item.id] ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" : "bg-white text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200"}`,
                      children: wishedEmployees[item.id] ? /* @__PURE__ */ jsx(CheckCircle2, { className: "w-4 h-4 text-emerald-600" }) : /* @__PURE__ */ jsx(Mail, { className: "w-4 h-4" })
                    }
                  )
                ] })
              ]
            },
            item.id
          );
        }) }),
        onNavigateTab && /* @__PURE__ */ jsxs("div", { className: "px-5 py-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between text-xs", children: [
          /* @__PURE__ */ jsx("span", { className: "text-slate-500", children: "Dates are based on employee profiles." }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => onNavigateTab("employees"),
              className: "font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1",
              children: [
                /* @__PURE__ */ jsx("span", { children: "Manage Employee Records" }),
                /* @__PURE__ */ jsx(ChevronRight, { className: "w-3.5 h-3.5" })
              ]
            }
          )
        ] })
      ]
    }
  );
};
export {
  CelebrationsWidget
};
