import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Award, Cake, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Heart, PartyPopper, Pause, Play, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import { goAnniversaryLabel } from '../../utils/celebrations';
import './team-celebrations.css';

export interface CelebrationItem {
  id: string;
  employee_id: string;
  name: string;
  type: string;
  date: string;
  days_until: number;
  years?: number; // Completed service years, never an employee's age.
  my_reaction: string | null;
  reactions: { emoji: string; people: { id: string; name: string }[] }[];
}
interface Data { today: string; items: CelebrationItem[] }
const reactionNames: Record<string, string> = { '🎉': 'Celebrate', '🎂': 'Birthday cake', '❤️': 'Love', '👏': 'Applause' };
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
const dateValue = (value: string) => new Date(`${value}T12:00:00Z`);
const displayDate = (value: string) => dateFormatter.format(dateValue(value));
const when = (days: number) => days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;

function CelebrationArt({ birthday }: { birthday: boolean }) {
  const id = useId();
  return <div className="go-celebration-art" aria-hidden="true">
    <div className="go-celebration-halo" />
    <svg className="go-celebration-illustration" viewBox="0 0 240 220" fill="none" focusable="false">
      <defs>
        <linearGradient id={`${id}-cake`} x1="64" y1="100" x2="180" y2="180" gradientUnits="userSpaceOnUse"><stop stopColor="#F4B56C" /><stop offset="1" stopColor="#ED9027" /></linearGradient>
        <linearGradient id={`${id}-ribbon`} x1="70" y1="60" x2="175" y2="180" gradientUnits="userSpaceOnUse"><stop stopColor="#7087A3" /><stop offset="1" stopColor="#3A5D83" /></linearGradient>
        <linearGradient id={`${id}-medal`} x1="80" y1="50" x2="150" y2="135" gradientUnits="userSpaceOnUse"><stop stopColor="#FFF1CA" /><stop offset="1" stopColor="#ED9027" /></linearGradient>
      </defs>
      <ellipse cx="120" cy="190" rx="76" ry="12" fill={birthday ? '#D49A5E' : '#7087A3'} opacity=".16" />
      {birthday ? <g className="go-celebration-float">
        <ellipse cx="120" cy="176" rx="80" ry="14" fill="#FFF" stroke="#F1DCC6" strokeWidth="2" />
        <path d="M56 119H184V162C184 180 56 180 56 162V119Z" fill={`url(#${id}-cake)`} />
        <path d="M56 146C84 160 156 160 184 146" stroke="#FFE5C9" strokeWidth="7" />
        <ellipse cx="120" cy="119" rx="64" ry="19" fill="#FFFBF4" />
        <path d="M56 119V132C56 143 73 143 73 132V129C73 126 81 126 81 130V138C81 151 99 151 99 138V135C99 130 108 130 108 135V143C108 155 126 155 126 143V137C126 133 134 133 134 137C134 148 152 148 152 137V130C152 125 160 125 160 130C160 144 184 141 184 130V119C172 140 68 140 56 119Z" fill="#FFFBF4" />
        <rect x="89" y="79" width="9" height="37" rx="4" fill="#7087A3" /><path d="M90 89L97 83M90 102L97 96" stroke="#CFD7E1" strokeWidth="3" />
        <rect x="116" y="66" width="9" height="47" rx="4" fill="#ED9027" /><path d="M117 79L124 73M117 93L124 87" stroke="#FFF0D9" strokeWidth="3" />
        <rect x="143" y="79" width="9" height="37" rx="4" fill="#7087A3" /><path d="M144 89L151 83M144 102L151 96" stroke="#CFD7E1" strokeWidth="3" />
        <g className="go-celebration-flames" fill="#ED9027"><path d="M93 77C80 71 91 61 94 56C98 64 104 73 93 77Z" /><path d="M120 64C107 58 118 48 121 43C125 51 131 60 120 64Z" /><path d="M147 77C134 71 145 61 148 56C152 64 158 73 147 77Z" /></g>
        <path d="M79 116L85 118M154 117L160 114M110 124L116 125M134 118L139 116" stroke="#ED9027" strokeWidth="3" strokeLinecap="round" />
      </g> : <g className="go-celebration-float">
        <path d="M85 111L67 175L93 165L108 186L124 123L85 111Z" fill={`url(#${id}-ribbon)`} />
        <path d="M154 111L173 175L147 165L132 186L116 123L154 111Z" fill="#3A5D83" />
        <circle cx="120" cy="96" r="55" fill={`url(#${id}-medal)`} stroke="#ED9027" strokeWidth="3" />
        <circle cx="120" cy="96" r="43" stroke="#FFFAE9" strokeWidth="3" />
        <path d="M120 65L129 84L150 87L135 102L138 123L120 113L102 123L105 102L90 87L111 84L120 65Z" fill="#FFF9E8" stroke="#CD7A19" strokeWidth="2" strokeLinejoin="round" />
        <path d="M81 61L85 58M155 133L159 130" stroke="#FFF" strokeWidth="3" strokeLinecap="round" />
      </g>}
    </svg>
    <span className="go-celebration-spark go-celebration-spark-one"><Sparkles size={22} /></span>
    <span className="go-celebration-spark go-celebration-spark-two"><Sparkles size={15} /></span>
    <span className="go-celebration-confetti go-celebration-confetti-one" />
    <span className="go-celebration-confetti go-celebration-confetti-two" />
    <span className="go-celebration-confetti go-celebration-confetti-three" />
  </div>;
}

interface SpotlightProps {
  item: CelebrationItem;
  busy: boolean;
  peopleOpen: boolean;
  onReact: (emoji: string) => void;
  onTogglePeople: () => void;
}
export function CelebrationSpotlight({ item, busy, peopleOpen, onReact, onTogglePeople }: SpotlightProps) {
  const birthday = item.type === 'birthday', today = item.days_until === 0;
  const total = item.reactions.reduce((sum, r) => sum + r.people.length, 0);
  const peopleId = useId();
  return <article className={`go-celebration-spotlight is-${birthday ? 'birthday' : 'anniversary'}${today ? ' is-today' : ''}`} aria-label={`${item.name}, ${birthday ? 'birthday' : 'work anniversary'}, ${when(item.days_until)}`}>
    <div className="go-celebration-copy">
      <div className="go-celebration-kicker"><span className="go-celebration-badge">{today ? <Sparkles size={14} aria-hidden="true" /> : <CalendarDays size={14} aria-hidden="true" />}{today ? 'Celebrating today' : 'Coming up'}</span>{!today && <span>{when(item.days_until)}</span>}</div>
      <h3 key={`${item.id}-title`} className="go-celebration-title">
        {birthday ? today ? <>It’s <span>{item.name}’s</span><br />birthday today!</> : <>Upcoming birthday:<br /><span>{item.name}</span></> : today ? <>Happy {goAnniversaryLabel(item.years)}!<br /><span>{item.name}</span></> : <>Upcoming {goAnniversaryLabel(item.years)}:<br /><span>{item.name}</span></>}
      </h3>
      <p className="go-celebration-message">{birthday ? today ? 'Your GO team wishes you a wonderful birthday!' : 'A special day is on the way. Let’s celebrate together!' : today ? `Celebrating ${item.years} ${item.years === 1 ? 'year' : 'years'} with GO. Thank you for everything you do!` : `${item.years} ${item.years === 1 ? 'year' : 'years'} with GO on ${displayDate(item.date)}. A milestone worth celebrating!`}</p>
      <div className="go-celebration-date-line">{birthday ? <Cake size={17} aria-hidden="true" /> : <Award size={17} aria-hidden="true" />}<span>{displayDate(item.date)}<span aria-hidden="true"> · </span>{birthday ? 'Birthday' : 'Work anniversary'}</span></div>
      {today ? <div className="go-celebration-reactions">
        <p className="go-celebration-reaction-prompt">Send a little celebration</p>
        <div className="go-celebration-reaction-buttons" role="group" aria-label="Celebration reactions" aria-busy={busy}>{item.reactions.map(r => <button type="button" key={r.emoji} disabled={busy} aria-label={`${reactionNames[r.emoji] || r.emoji}, ${r.people.length} ${r.people.length === 1 ? 'reaction' : 'reactions'}`} aria-pressed={item.my_reaction === r.emoji} onClick={() => onReact(r.emoji)}><span aria-hidden="true">{r.emoji}</span><span>{r.people.length}</span></button>)}</div>
        {total > 0 ? <button type="button" className="go-celebration-people-toggle" onClick={onTogglePeople} aria-expanded={peopleOpen} aria-controls={peopleId}><Heart size={13} aria-hidden="true" />{total} {total === 1 ? 'teammate has' : 'teammates have'} celebrated<ChevronDown size={14} aria-hidden="true" /></button> : <p className="go-celebration-first">Be the first to celebrate!</p>}
        {peopleOpen && total > 0 && <ul className="go-celebration-people" id={peopleId} aria-label="Who reacted">{item.reactions.filter(r => r.people.length > 0).map(r => <li key={r.emoji}><span aria-label={reactionNames[r.emoji]}>{r.emoji}</span><span>{r.people.map(p => p.name).join(', ')}</span></li>)}</ul>}
      </div> : <p className="go-celebration-reminder"><Heart size={14} aria-hidden="true" />Send your reactions on the day.</p>}
    </div>
    <div className="go-celebration-scene">
      <div className="go-celebration-date-stamp" aria-hidden="true"><span>{monthFormatter.format(dateValue(item.date))}</span><strong>{Number(item.date.slice(8, 10))}</strong><small>{when(item.days_until)}</small></div>
      <CelebrationArt birthday={birthday} />
      <span className="go-celebration-scene-caption" aria-hidden="true">{birthday ? today ? 'Make a wish!' : 'A little joy, coming soon' : today ? 'Here’s to you!' : 'Another year of great work'}</span>
    </div>
  </article>;
}

export function TeamCelebrations() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
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
      if (version === requestVersion.current) { setData(next); setError(''); }
    } catch {
      if (version === requestVersion.current) setError('Celebrations could not refresh. Please try again.');
    }
  }, []);
  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 60000);
    const refresh = () => { setVisible(!document.hidden); if (!document.hidden) void load(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motionChanged = () => setReducedMotion(media.matches);
    motionChanged(); media.addEventListener('change', motionChanged);
    return () => { clearInterval(interval); ++requestVersion.current; window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); media.removeEventListener('change', motionChanged); };
  }, [load]);
  const items = data?.items || [], item = items[index % Math.max(1, items.length)];
  const todayCount = items.filter(i => i.days_until === 0).length;
  const motionPaused = manualPause || reducedMotion || !visible;
  useEffect(() => {
    if (items.length < 2 || motionPaused || hovered || focused || upcoming || peopleOpen || busy) return;
    const interval = setInterval(() => setIndex(i => i + 1), 8000);
    return () => clearInterval(interval);
  }, [items.length, motionPaused, hovered, focused, upcoming, peopleOpen, busy]);
  function select(next: number) { setIndex(next); setPeopleOpen(false); }
  async function react(emoji: string) {
    if (!item || mutationPending.current) return;
    mutationPending.current = true; setBusy(true);
    const version = ++requestVersion.current;
    try {
      const next = await api.reactToCelebration(item.id, item.my_reaction === emoji ? null : emoji);
      if (version === requestVersion.current) { setData(next); setError(''); }
    } catch (e) {
      if (version === requestVersion.current) setError(e instanceof Error ? e.message : 'Your reaction could not be saved. Please try again.');
    } finally { mutationPending.current = false; setBusy(false); }
  }
  return <section aria-label="Team celebrations" className={`go-team-celebrations${motionPaused ? ' is-motion-paused' : ''}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
    <header className="go-celebration-header">
      <div className="go-celebration-heading"><span className="go-celebration-heading-icon"><PartyPopper size={20} aria-hidden="true" /></span><div><h2>Team celebrations</h2><p>Birthdays & work anniversaries</p></div></div>
      <div className="go-celebration-header-actions">
        {todayCount > 0 && <span className="go-celebration-today-count">{todayCount} today</span>}
        <button type="button" className="go-celebration-week-toggle" aria-expanded={upcoming} aria-controls={upcomingId} onClick={() => setUpcoming(v => !v)}>{upcoming ? 'Hide upcoming' : 'View next 7 days'}<ChevronDown size={16} aria-hidden="true" /></button>
        {item && <button type="button" className="go-celebration-icon-button go-celebration-motion-toggle" aria-label={manualPause ? 'Play celebration animation' : 'Pause celebration animation'} title={manualPause ? 'Play animation' : 'Pause animation'} aria-pressed={manualPause} onClick={() => setManualPause(v => !v)}>{manualPause ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}</button>}
      </div>
    </header>
    {error && <div role="alert" className="go-celebration-error">{error}<button type="button" onClick={() => void load()}>Retry</button></div>}
    {!data && !error && <p role="status" className="go-celebration-empty">Loading celebrations…</p>}
    {item ? <>
      <CelebrationSpotlight item={item} busy={busy} peopleOpen={peopleOpen} onReact={emoji => void react(emoji)} onTogglePeople={() => setPeopleOpen(v => !v)} />
      {items.length > 1 && <nav className="go-celebration-navigation" aria-label="Browse celebrations"><span>More moments to celebrate</span><div><button type="button" className="go-celebration-icon-button" disabled={busy} aria-label="Previous celebration" onClick={() => select((index + items.length - 1) % items.length)}><ChevronLeft size={18} aria-hidden="true" /></button><span aria-live="off">{index % items.length + 1} / {items.length}</span><button type="button" className="go-celebration-icon-button" disabled={busy} aria-label="Next celebration" onClick={() => select(index + 1)}><ChevronRight size={18} aria-hidden="true" /></button></div></nav>}
    </> : data && <div className="go-celebration-empty"><Sparkles size={24} aria-hidden="true" /><p>No birthdays or work anniversaries in the next 7 days.<small>The next team celebration will appear here.</small></p></div>}
    {upcoming && <div id={upcomingId} className="go-celebration-week"><h3>The next 7 days</h3>{items.length ? <ul>{items.map((event, i) => <li key={event.id}><button type="button" disabled={busy} className={`go-celebration-week-card is-${event.type}`} aria-label={`${event.name}, ${event.type === 'birthday' ? 'birthday' : 'work anniversary'}, ${displayDate(event.date)}`} aria-pressed={item?.id === event.id} onClick={() => select(i)}><span className="go-celebration-week-icon">{event.type === 'birthday' ? <Cake size={18} aria-hidden="true" /> : <Award size={18} aria-hidden="true" />}</span><span className="go-celebration-week-person"><strong>{event.name}</strong><small>{event.type === 'birthday' ? 'Birthday' : 'Work anniversary'} · {displayDate(event.date)}</small></span><span className="go-celebration-week-when">{when(event.days_until)}</span></button></li>)}</ul> : <p>No celebrations are scheduled for this week.</p>}</div>}
  </section>;
}
