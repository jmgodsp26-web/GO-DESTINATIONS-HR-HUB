import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Award, Cake, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Heart, PartyPopper, Pause, Play, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import { goAnniversaryLabel } from '../../utils/celebrations';
import { launchConfetti } from '../../utils/confetti';
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
const dateValue = (value: string) => new Date(`${value}T12:00:00Z`);
const displayDate = (value: string) => dateFormatter.format(dateValue(value));
const when = (days: number) => days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;

/** Brand-colour cake or medal inside a slowly turning dashed ring. Decorative. */
function CelebrationArt({ birthday }: { birthday: boolean }) {
  return <div className="go-celebration-art" aria-hidden="true">
    <svg className="go-celebration-illustration" viewBox="0 0 190 180" fill="none" focusable="false">
      <circle className="go-celebration-ring" cx="95" cy="92" r="82" fill="#F4F6F9" stroke="#CFD7E1" strokeWidth="3" strokeDasharray="9 9" />
      <circle className="go-celebration-dot" cx="26" cy="40" r="5" fill="#ED9027" />
      <circle className="go-celebration-dot" style={{ animationDelay: '.7s' }} cx="166" cy="52" r="4" fill="#3A5D83" />
      <circle className="go-celebration-dot" style={{ animationDelay: '1.3s' }} cx="160" cy="138" r="4.5" fill="#F1C48E" />
      <circle className="go-celebration-dot" style={{ animationDelay: '1.9s' }} cx="30" cy="132" r="3.5" fill="#7087A3" />
      {birthday ? <g className="go-celebration-float">
        <ellipse cx="95" cy="148" rx="64" ry="9" fill="#CFD7E1" />
        <rect x="41" y="104" width="108" height="42" rx="13" fill="#ED9027" />
        <path d="M41 116q9 9 18 0q9 9 18 0q9 9 18 0q9 9 18 0q9 9 18 0q9 9 18 0v-8a12 12 0 0 0-12-12h-84a12 12 0 0 0-12 12z" fill="#FFFFFF" />
        <rect x="60" y="128" width="9" height="3.5" rx="1.75" fill="#182E3F" transform="rotate(20 64 130)" />
        <rect x="90" y="133" width="9" height="3.5" rx="1.75" fill="#FFFFFF" transform="rotate(-25 94 135)" />
        <rect x="120" y="127" width="9" height="3.5" rx="1.75" fill="#3A5D83" transform="rotate(15 124 129)" />
        <rect x="59" y="72" width="72" height="34" rx="11" fill="#3A5D83" />
        <path d="M59 82q7.2 7 14.4 0q7.2 7 14.4 0q7.2 7 14.4 0q7.2 7 14.4 0q7.2 7 14.4 0v-1a9 9 0 0 0-9-9h-54a9 9 0 0 0-9 9z" fill="#FFFFFF" />
        <rect x="78" y="48" width="8" height="24" rx="3" fill="#182E3F" />
        <rect x="104" y="48" width="8" height="24" rx="3" fill="#F1C48E" />
        <path className="go-celebration-flame" d="M82 32q7 8 0 15q-7-7 0-15z" fill="#ED9027" />
        <path className="go-celebration-flame is-late" d="M108 32q7 8 0 15q-7-7 0-15z" fill="#ED9027" />
      </g> : <g className="go-celebration-float">
        <path d="M70 96 56 152l21-9 12 19 13-52z" fill="#3A5D83" />
        <path d="M120 96l14 56-21-9-12 19-13-52z" fill="#182E3F" />
        <circle cx="95" cy="80" r="44" fill="#ED9027" />
        <circle cx="95" cy="80" r="44" stroke="#C9721A" strokeWidth="3" />
        <circle cx="95" cy="80" r="34" stroke="#F8DEC1" strokeWidth="3" />
        <path d="M95 56l7 15 16.500 2.200-12 11.500 3 16.300L95 93.200 80.500 101l3-16.300-12-11.500L88 71z" fill="#FFFFFF" />
        <path className="go-celebration-shine" d="M66 62q8-14 22-18" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity=".7" />
      </g>}
    </svg>
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
      <div className="go-celebration-kicker">
        <span className="go-celebration-badge">{today ? <Sparkles size={14} aria-hidden="true" /> : <CalendarDays size={14} aria-hidden="true" />}{today ? 'Celebrating today' : 'Coming up'}</span>
        {!today && <span className="go-celebration-when">{when(item.days_until)}</span>}
        <span className="go-celebration-date-line">{birthday ? <Cake size={15} aria-hidden="true" /> : <Award size={15} aria-hidden="true" />}<span>{displayDate(item.date)}<span aria-hidden="true"> · </span>{birthday ? 'Birthday' : 'Work anniversary'}</span></span>
      </div>
      <h3 key={`${item.id}-title`} className="go-celebration-title">
        {birthday ? today ? <>It’s <span>{item.name}’s</span> birthday today!</> : <>Upcoming birthday: <span>{item.name}</span></> : today ? <>Happy {goAnniversaryLabel(item.years)}! <span>{item.name}</span></> : <>Upcoming {goAnniversaryLabel(item.years)}: <span>{item.name}</span></>}
      </h3>
      <p className="go-celebration-message">{birthday ? today ? 'Your GO team wishes you a wonderful birthday!' : 'A special day is on the way. Let’s celebrate together!' : today ? `Celebrating ${item.years} ${item.years === 1 ? 'year' : 'years'} with GO. Thank you for everything you do!` : `${item.years} ${item.years === 1 ? 'year' : 'years'} with GO on ${displayDate(item.date)}. A milestone worth celebrating!`}</p>
      {today ? <div className="go-celebration-reactions">
        <p className="go-celebration-reaction-prompt sr-only">Send a little celebration</p>
        <div className="go-celebration-reaction-row">
          <div className="go-celebration-reaction-buttons" role="group" aria-label="Celebration reactions" aria-busy={busy}>{item.reactions.map(r => <button type="button" key={r.emoji} disabled={busy} aria-label={`${reactionNames[r.emoji] || r.emoji}, ${r.people.length} ${r.people.length === 1 ? 'reaction' : 'reactions'}`} aria-pressed={item.my_reaction === r.emoji} onClick={() => onReact(r.emoji)}><span aria-hidden="true">{r.emoji}</span>{r.people.length > 0 && <span>{r.people.length}</span>}</button>)}</div>
          {total > 0 ? <button type="button" className="go-celebration-people-toggle" onClick={onTogglePeople} aria-expanded={peopleOpen} aria-controls={peopleId}><Heart size={13} aria-hidden="true" />{total} {total === 1 ? 'teammate has' : 'teammates have'} celebrated<ChevronDown size={14} aria-hidden="true" /></button> : <p className="go-celebration-first">Be the first to celebrate!</p>}
        </div>
        {peopleOpen && total > 0 && <ul className="go-celebration-people" id={peopleId} aria-label="Who reacted">{item.reactions.filter(r => r.people.length > 0).map(r => <li key={r.emoji}><span aria-label={reactionNames[r.emoji]}>{r.emoji}</span><span>{r.people.map(p => p.name).join(', ')}</span></li>)}</ul>}
      </div> : <p className="go-celebration-reminder"><Heart size={14} aria-hidden="true" />Send your reactions on the day.</p>}
    </div>
    <CelebrationArt birthday={birthday} />
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
    const adding = item.my_reaction !== emoji;
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    try {
      const next = await api.reactToCelebration(item.id, adding ? emoji : null);
      if (version === requestVersion.current) { setData(next); setError(''); }
      if (adding && !motionPaused) launchConfetti(origin, 30);
    } catch (e) {
      if (version === requestVersion.current) setError(e instanceof Error ? e.message : 'Your reaction could not be saved. Please try again.');
    } finally { mutationPending.current = false; setBusy(false); }
  }
  return <section aria-label="Team celebrations" className={`go-team-celebrations${motionPaused ? ' is-motion-paused' : ''}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
    <header className="go-celebration-header">
      <div className="go-celebration-heading"><span className="go-celebration-heading-icon"><PartyPopper size={20} aria-hidden="true" /></span><div><h2>Team celebrations</h2><p>Birthdays &amp; work anniversaries this week</p></div></div>
      <div className="go-celebration-header-actions">
        {todayCount > 0 && <span className="go-celebration-today-count">{todayCount} today</span>}
        <button type="button" className="go-celebration-week-toggle" aria-expanded={upcoming} aria-controls={upcomingId} onClick={() => setUpcoming(v => !v)}>{upcoming ? 'Hide upcoming' : 'View next 7 days'}<ChevronDown size={16} aria-hidden="true" /></button>
        {item && <button type="button" className="go-celebration-icon-button go-celebration-motion-toggle" aria-label={manualPause ? 'Play celebration animation' : 'Pause celebration animation'} title={manualPause ? 'Play animation' : 'Pause animation'} aria-pressed={manualPause} onClick={() => setManualPause(v => !v)}>{manualPause ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}</button>}
      </div>
    </header>
    {error && <div role="alert" className="go-celebration-error">{error}<button type="button" onClick={() => void load()}>Retry</button></div>}
    {!data && !error && <p role="status" className="go-celebration-empty">Loading celebrations…</p>}
    {item ? <div className="go-celebration-stage">
      <CelebrationSpotlight item={item} busy={busy} peopleOpen={peopleOpen} onReact={emoji => void react(emoji)} onTogglePeople={() => setPeopleOpen(v => !v)} />
      {items.length > 1 && <nav className="go-celebration-navigation" aria-label="Browse celebrations"><span className="go-celebration-dots" aria-hidden="true">{items.map((event, i) => <i key={event.id} className={i === index % items.length ? 'is-current' : undefined} />)}</span><div><button type="button" className="go-celebration-icon-button" disabled={busy} aria-label="Previous celebration" onClick={() => select((index + items.length - 1) % items.length)}><ChevronLeft size={18} aria-hidden="true" /></button><span aria-live="off">{index % items.length + 1} / {items.length}</span><button type="button" className="go-celebration-icon-button" disabled={busy} aria-label="Next celebration" onClick={() => select(index + 1)}><ChevronRight size={18} aria-hidden="true" /></button></div></nav>}
    </div> : data && <div className="go-celebration-empty"><Sparkles size={24} aria-hidden="true" /><p>No birthdays or work anniversaries in the next 7 days.<small>The next team celebration will appear here.</small></p></div>}
    {upcoming && <div id={upcomingId} className="go-celebration-week"><h3>The next 7 days</h3>{items.length ? <ul>{items.map((event, i) => <li key={event.id}><button type="button" disabled={busy} className={`go-celebration-week-card is-${event.type}`} aria-label={`${event.name}, ${event.type === 'birthday' ? 'birthday' : 'work anniversary'}, ${displayDate(event.date)}`} aria-pressed={item?.id === event.id} onClick={() => select(i)}><span className="go-celebration-week-icon">{event.type === 'birthday' ? <Cake size={18} aria-hidden="true" /> : <Award size={18} aria-hidden="true" />}</span><span className="go-celebration-week-person"><strong>{event.name}</strong><small>{event.type === 'birthday' ? 'Birthday' : 'Work anniversary'} · {displayDate(event.date)}</small></span><span className="go-celebration-week-when">{when(event.days_until)}</span></button></li>)}</ul> : <p>No celebrations are scheduled for this week.</p>}</div>}
  </section>;
}
