/**
 * Utility functions for exporting leave records and holiday shifts to .ics files
 * and external calendar providers (Google Calendar).
 */

export interface CalendarEventData {
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  description?: string;
  location?: string;
  isHalfDay?: boolean;
  halfDayPeriod?: 'morning' | 'afternoon';
  employeeName?: string;
}

/**
 * Formats a YYYY-MM-DD string into ICS date format YYYYMMDD
 */
function formatIcsDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

/**
 * Adds one day to YYYY-MM-DD for full-day inclusive ICS DTEND
 */
function getNextDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dayStr = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${dayStr}`;
}

/**
 * Generates standard RFC 5545 iCalendar (.ics) string
 */
export function generateIcsContent(event: CalendarEventData): string {
  const now = new Date();
  const dtStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = `hrhub-leave-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@godestinations.com`;

  let dtStartLine = '';
  let dtEndLine = '';

  if (event.isHalfDay) {
    const isMorning = event.halfDayPeriod === 'morning';
    const startHour = isMorning ? '090000' : '130000';
    const endHour = isMorning ? '130000' : '170000';
    const cleanDate = formatIcsDate(event.startDate);
    dtStartLine = `DTSTART:${cleanDate}T${startHour}`;
    dtEndLine = `DTEND:${cleanDate}T${endHour}`;
  } else {
    // Standard full day event
    const startFormatted = formatIcsDate(event.startDate);
    const endPlusOne = getNextDay(event.endDate || event.startDate);
    dtStartLine = `DTSTART;VALUE=DATE:${startFormatted}`;
    dtEndLine = `DTEND;VALUE=DATE:${endPlusOne}`;
  }

  const cleanTitle = (event.title || 'Out of Office (Leave)')
    .replace(/\n/g, ' ')
    .replace(/[,;]/g, ' ');

  const cleanDescription = (event.description || 'Approved Leave via GO Destinations HR Hub')
    .replace(/\n/g, '\\n')
    .replace(/[,;]/g, ' ');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GO Destinations//HR Hub//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    dtStartLine,
    dtEndLine,
    `SUMMARY:${cleanTitle}`,
    `DESCRIPTION:${cleanDescription}`,
    event.location ? `LOCATION:${event.location}` : 'LOCATION:GO Destinations',
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

/**
 * Triggers a browser download of the .ics file
 */
export function downloadIcsFile(event: CalendarEventData, filename?: string): void {
  const icsText = generateIcsContent(event);
  const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const defaultName = filename || `Leave_${event.startDate}_${event.title.replace(/\s+/g, '_')}.ics`;
  link.setAttribute('download', defaultName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates a direct Google Calendar event creation URL
 */
export function getGoogleCalendarUrl(event: CalendarEventData): string {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const text = encodeURIComponent(event.title);
  const details = encodeURIComponent(event.description || 'Approved leave via HR Hub');
  const location = encodeURIComponent(event.location || 'GO Destinations');

  let dates = '';
  if (event.isHalfDay) {
    const isMorning = event.halfDayPeriod === 'morning';
    const startHour = isMorning ? '090000' : '130000';
    const endHour = isMorning ? '130000' : '170000';
    const d = formatIcsDate(event.startDate);
    dates = `${d}T${startHour}/${d}T${endHour}`;
  } else {
    const start = formatIcsDate(event.startDate);
    const end = getNextDay(event.endDate || event.startDate);
    dates = `${start}/${end}`;
  }

  return `${base}&text=${text}&dates=${dates}&details=${details}&location=${location}`;
}

import type { CalendarEvent } from '../types';

export function eventsOnDate(events: CalendarEvent[], date: string) {
  return events.filter(event => date >= event.date && date <= (event.end_date || event.date));
}
export function filterCalendarEvents(events: CalendarEvent[], types: CalendarEvent['type'][], department: string) {
  return events.filter(event => types.includes(event.type) && (department === 'all' || event.type === 'holiday' || (event.employee_department || event.department) === department));
}
export function monthDates(month: string) {
  const [year, number] = month.split('-').map(Number);
  const count = new Date(year, number, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}
export function moveCalendarMonth(month: string, offset: number) {
  const [year, number] = month.split('-').map(Number);
  const next = new Date(year, number - 1 + offset, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}
