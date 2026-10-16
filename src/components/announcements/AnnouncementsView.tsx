import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog } from '../common/Dialog';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useViewPreference } from '../../hooks/useViewPreference';
import { useNavigation } from '../../context/NavigationContext';
import { LoadError, RefreshStatus } from '../common/LoadFeedback';
import { Megaphone, Plus, Pin, ArrowRight, X, CheckCheck, Eye, Pencil, Archive, RefreshCw, Search } from 'lucide-react';
import { ANNOUNCEMENT_CATEGORIES, OFFICIAL_DEPARTMENTS, type AnnouncementInput, type AnnouncementView, type AnnouncementReport } from '../../types';
import { EMPLOYEE_COUNTRIES } from '../../utils/countryUtils';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { PageHeading } from '../common/WorkspaceUI';
import './announcements.css';

const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not published';
const expired = (item: AnnouncementView) => Boolean(item.expires_at && Date.parse(item.expires_at) <= Date.now());
const audienceLabel = (item: Pick<AnnouncementInput, 'departments' | 'countries'>) => `${item.departments.join(', ') || 'All departments'} · ${item.countries.join(', ') || 'All countries'}`;
const blank = (): AnnouncementInput => ({ title: '', message: '', category: 'Company news', departments: [], countries: [], pinned: false, requires_acknowledgment: false, expires_at: null, status: 'draft' });

function Message({ item }: { item: Pick<AnnouncementInput, 'category' | 'title' | 'message' | 'pinned'> }) {
  return <article className="go-ann-message"><div className="go-ann-tags"><span>{item.category}</span>{item.pinned && <span><Pin size={12} />Pinned</span>}</div>
    <h3>{item.title || 'Announcement title'}</h3><p>{item.message || 'Your announcement message will appear here.'}</p></article>;
}
function AnnouncementDetail({ item, preview = false, onClose, onChange }: { item: AnnouncementView; preview?: boolean; onClose: () => void; onChange: (item: AnnouncementView) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function acknowledge() {
    setBusy(true); setError('');
    try { onChange(await api.readAnnouncement(item, true)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <Dialog className="go-ann-dialog" busy={busy} title={preview ? 'Announcement preview' : 'Company announcement'} onClose={() => { if (!busy) onClose(); }}>
    <div className="go-ann-dialog-body">
      {preview && <p className="go-ann-note">Admin preview. This does not mark the announcement as read or acknowledged.</p>}
      <Message item={item} />
      <p className="go-ann-meta">By {item.author_name} · {dateLabel(item.published_at)} · Version {item.revision}</p>
      {item.expires_at && <p className="go-ann-meta">Available until {dateLabel(item.expires_at)}</p>}
      {error && <p className="go-ann-error" role="alert">{error}</p>}
      {!preview && item.requires_acknowledgment && <div className="go-ann-ack">
        {item.acknowledged_at ? <p role="status"><CheckCheck size={18} />Acknowledged on {dateLabel(item.acknowledged_at)}</p> : <><p>{item.revision > 1 ? 'This announcement has been updated. Please read and acknowledge the current version.' : 'Please confirm that you have read this update.'}</p><button type="button" className="go-ann-primary" disabled={busy} onClick={acknowledge}>{busy ? 'Saving…' : 'I have read and acknowledge this'}</button></>}
      </div>}
    </div>
  </Dialog>;
}

function AnnouncementEditor({ existing, onClose, onSaved }: { existing?: AnnouncementView; onClose: () => void; onSaved: (item: AnnouncementView) => void }) {
  const [form, setForm] = useState<AnnouncementInput>(existing ? { ...existing, status: existing.status === 'published' ? 'published' : 'draft' } : blank());
  const [preview, setPreview] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const initial = useRef(JSON.stringify(form));
  const canClose = useUnsavedChanges(JSON.stringify(form) !== initial.current, busy);
  const closeEditor = () => { if (canClose()) onClose(); };
  const [audience, setAudience] = useState<{ count?: number; error?: string }>({});
  useEffect(() => {
    let active = true; setAudience({});
    const timer = setTimeout(() => { api.previewAnnouncementAudience(form.departments, form.countries).then(result => { if (active) setAudience(result); }).catch(() => { if (active) setAudience({ error: 'Recipient count could not load. Check your audience before publishing.' }); }); }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [form.departments, form.countries]);
  const patch = (data: Partial<AnnouncementInput>) => setForm(previous => ({ ...previous, ...data }));
  const toggle = (key: 'departments' | 'countries', value: string) => setForm(previous => ({ ...previous, [key]: previous[key].includes(value) ? previous[key].filter(v => v !== value) : [...previous[key], value] }));
  const localExpiry = form.expires_at ? new Date(Date.parse(form.expires_at) - new Date(form.expires_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const status = ((event.nativeEvent as SubmitEvent).submitter?.getAttribute('data-status') || form.status) as 'draft' | 'published';
    try { const result = await api.saveAnnouncement({ ...form, status }, existing); onSaved(result); }
    catch (e) { setError((e as Error).message); setPreview(false); }
    finally { setBusy(false); }
  }
  return <Dialog className="go-ann-dialog" busy={busy} title={existing ? 'Edit announcement' : 'Create announcement'} onClose={closeEditor}>
    <form onSubmit={save} noValidate={preview} className="go-ann-editor">
      <fieldset disabled={busy}>
        <div className="go-ann-editor-tabs"><button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>Write</button><button type="button" aria-pressed={preview} onClick={() => setPreview(true)}><Eye size={15} />Preview</button></div>
        {/* Server validation also applies when publishing from the preview. */}
        {preview && <div className="go-ann-preview"><Message item={form} /><p className="go-ann-meta">Audience: {audienceLabel(form)}</p>{form.requires_acknowledgment && <p className="go-ann-note">Acknowledgment required</p>}</div>}
        <div className={preview ? 'go-ann-fields go-ann-fields-preview' : 'go-ann-fields'}>
          <label>Title<input required maxLength={160} value={form.title} onChange={e => patch({ title: e.target.value })} placeholder="What does your team need to know?" /></label>
          <label>Category<select value={form.category} onChange={e => patch({ category: e.target.value as AnnouncementInput['category'] })}>{ANNOUNCEMENT_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
          <label>Message<textarea required maxLength={10000} rows={7} value={form.message} onChange={e => patch({ message: e.target.value })} placeholder="Write a clear update with any next steps for employees." /><span className="go-ann-hint">Plain text · {form.message.length.toLocaleString()} / 10,000 characters</span></label>
          <section className="go-ann-audience"><h3>Who should see this?</h3><p>Leave a group unselected to include everyone in that group. If you choose both, employees must match a selected department and country. Country uses the employee’s profile location.</p>
            <fieldset><legend>Departments</legend><div className="go-ann-choice-grid">{OFFICIAL_DEPARTMENTS.map(value => <label key={value}><input type="checkbox" checked={form.departments.includes(value)} onChange={() => toggle('departments', value)} />{value}</label>)}</div></fieldset>
            <fieldset><legend>Countries</legend><div className="go-ann-choice-grid">{EMPLOYEE_COUNTRIES.map(value => <label key={value}><input type="checkbox" checked={form.countries.includes(value)} onChange={() => toggle('countries', value)} />{value}</label>)}</div></fieldset>
          </section>
          <div className="go-ann-options"><label><input type="checkbox" checked={form.pinned} onChange={e => patch({ pinned: e.target.checked })} />Pin at the top</label><label><input type="checkbox" checked={form.requires_acknowledgment} onChange={e => patch({ requires_acknowledgment: e.target.checked })} />Require acknowledgment</label></div>
          <label>Expiry date and time (optional)<input type="datetime-local" value={localExpiry} onChange={e => patch({ expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /><span className="go-ann-hint">Uses your browser’s local time. Expired announcements are hidden from employees.</span></label>
        </div>
      </fieldset>
      <div className="go-live-audience" role="status">{audience.error || (audience.count === undefined ? 'Checking audience…' : `${audience.count} active ${audience.count === 1 ? 'employee' : 'employees'} will receive this announcement.`)}{audience.count === 0 && <p>No employees currently match. Change the audience or save a draft.</p>}</div>
      {existing?.status === 'published' && <p className="go-ann-note">Publishing changes sends a new notification and resets read and acknowledgment status for this version.</p>}
      {error && <p className="go-ann-error" role="alert">{error}</p>}
      <footer><button type="button" onClick={closeEditor} disabled={busy}>Cancel</button>
        {existing?.status !== 'published' && <button type="submit" data-status="draft" disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</button>}
        <button type="submit" data-status="published" className="go-ann-primary" disabled={busy || audience.count === 0 || audience.count === undefined || Boolean(audience.error)}>{busy ? 'Saving…' : existing?.status === 'published' ? 'Publish changes' : 'Publish announcement'}</button>
      </footer>
    </form>
  </Dialog>;
}

function Readership({ item, onClose }: { item: AnnouncementView; onClose: () => void }) {
  const [recipientFilter, setRecipientFilter] = useState('all');
  const [report, setReport] = useState<AnnouncementReport | null>(null), [error, setError] = useState('');
  useEffect(() => { let active = true; api.announcementReport(item.id).then(result => { if (active) setReport(result); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [item.id]);
  return <Dialog className="go-ann-dialog" title="Read & acknowledgment report" onClose={onClose}><div className="go-ann-dialog-body">
    <h3>{item.title}</h3><p className="go-ann-meta">Active employees in the current audience. Status applies to version {report?.revision ?? item.revision}.</p>
    {error ? <p role="alert" className="go-ann-error">{error}</p> : !report ? <p role="status">Loading report…</p> : <>
      <p className="go-ann-report-summary">{report.recipients.length} recipients · {report.recipients.filter(r => r.read_at).length} read{item.requires_acknowledgment ? ` · ${report.recipients.filter(r => r.acknowledged_at).length} acknowledged` : ''}</p>
      <label className="go-workflow-label">Show recipients <select value={recipientFilter} onChange={e => setRecipientFilter(e.target.value)}><option value="all">Everyone</option><option value="unread">Not read yet</option>{item.requires_acknowledgment && <option value="pending">Not acknowledged yet</option>}<option value="read">Read</option></select></label>
      <div className="go-ann-table-wrap"><table><caption className="sr-only">Read and acknowledgment status by employee</caption><thead><tr><th>Employee</th><th>Read</th><th>Acknowledged</th></tr></thead><tbody>{report.recipients.filter(r => recipientFilter === 'all' || (recipientFilter === 'unread' ? !r.read_at : recipientFilter === 'pending' ? !r.acknowledged_at : Boolean(r.read_at))).map(r => <tr key={r.user_id}><td><strong>{r.name}</strong><small>{r.department}</small></td><td>{r.read_at ? dateLabel(r.read_at) : 'Not yet'}</td><td>{!item.requires_acknowledgment ? 'Not required' : r.acknowledged_at ? dateLabel(r.acknowledged_at) : 'Not yet'}</td></tr>)}</tbody></table></div>
      {!report.recipients.length && <p>No active employees currently match this audience.</p>}
    </>}
  </div></Dialog>;
}

export function AnnouncementsView() {
  const { isAdministration: manage } = useWorkspace();
  const { refreshNotifications } = useAuth();
  const [items, setItems] = useState<AnnouncementView[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [query, setQuery] = useState(''), [filter, setFilter] = useViewPreference('announcements:status', 'published');
  const [readFilter, setReadFilter] = useViewPreference('announcements:read', 'all');
  const [hasLoaded, setHasLoaded] = useState(false);
  const { params, navigate } = useNavigation(); const linkedId = params.get('id');
  const openedId = useRef<string | null>(null);
  const [editor, setEditor] = useState<AnnouncementView | 'new' | null>(null), [detail, setDetail] = useState<AnnouncementView | null>(null), [report, setReport] = useState<AnnouncementView | null>(null), [archive, setArchive] = useState<AnnouncementView | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(''); try { setItems(await api.getAnnouncements(manage)); setHasLoaded(true); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }, [manage]);
  useEffect(() => { void load(); }, [load]);
  const update = (item: AnnouncementView) => { setItems(previous => previous.map(a => a.id === item.id ? item : a)); setDetail(item); void refreshNotifications(); };
  async function open(item: AnnouncementView) {
    if (manage) { setDetail(item); return; }
    setBusy(true); setError(''); try { update(await api.readAnnouncement(item)); } catch (e) { openedId.current = null; setError((e as Error).message); } finally { setBusy(false); }
  }
  useEffect(() => {
    if (!linkedId) { openedId.current = null; setDetail(null); return; }
    if (!hasLoaded || openedId.current === linkedId) return;
    openedId.current = linkedId;
    const linked = items.find(item => item.id === linkedId);
    if (linked) void open(linked); else setError('This announcement is no longer available to your account.');
  }, [linkedId, hasLoaded, items]);
  const openLinked = (item: AnnouncementView) => { if (linkedId === item.id) void open(item); else navigate(`${manage ? 'administration' : 'personal'}/announcements?id=${encodeURIComponent(item.id)}`); };
  const visible = items.filter(a => (manage || !expired(a)) && (manage || readFilter === 'all' || (readFilter === 'unread' ? !a.read_at : a.requires_acknowledgment && !a.acknowledged_at)) && (!manage || filter === 'all' || a.status === filter) && `${a.title} ${a.message}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="go-ann-page space-y-6">
    <div className="go-page-header"><PageHeading eyebrow="Stay connected" title="Announcements" description={manage ? 'Share company updates, HR reminders, and important policies.' : 'Company news and updates that matter to you.'} /><div className="go-page-actions"><button type="button" className="go-button go-button-secondary" disabled={loading || busy} onClick={load}><RefreshCw size={16} />Refresh</button>{manage && <button type="button" className="go-button go-button-primary" onClick={() => setEditor('new')}><Plus size={16} />Create announcement</button>}</div></div>
    <div className="go-ann-toolbar"><label><Search size={17} /><input aria-label="Search announcements" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search announcements…" /></label>{manage && <select aria-label="Announcement status" value={filter} onChange={e => setFilter(e.target.value)}><option value="published">Published</option><option value="draft">Drafts</option><option value="archived">Archived</option><option value="all">All announcements</option></select>}</div>
    {!manage && <div className="go-read-filter" aria-label="Filter company updates">{[['all', 'All updates'], ['unread', 'Unread'], ['pending', 'Needs acknowledgment']].map(([value, label]) => <button key={value} type="button" aria-pressed={readFilter === value} onClick={() => setReadFilter(value)}>{label}</button>)}</div>}
    {error && <LoadError message={error} onRetry={load} />}<RefreshStatus active={loading && hasLoaded} />
    {loading && !hasLoaded ? <div className="go-ann-empty" role="status">Loading company updates…</div> : error && !hasLoaded ? null : !visible.length ? <div className="go-ann-empty"><Megaphone size={32} /><h2>{query || (!manage && readFilter !== 'all') ? 'No matching announcements' : 'No announcements here yet'}</h2><p>{query || (!manage && readFilter !== 'all') ? 'Try another filter or view all updates.' : manage ? 'Create a draft or publish your first company update.' : 'New company updates will appear here.'}</p></div> :
      <div className="go-ann-list">{visible.map(item => <article key={item.id} className={`go-ann-card ${item.pinned ? 'is-pinned' : ''}`}>
        <div className="go-ann-tags"><span>{item.category}</span>{item.pinned && <span><Pin size={12} />Pinned</span>}{manage && <span>{item.status === 'published' && expired(item) ? 'Expired' : item.status}</span>}{!manage && !item.read_at && <span className="go-ann-unread">{item.revision > 1 ? 'Updated' : 'New'}</span>}{item.requires_acknowledgment && <span>{item.acknowledged_at ? 'Acknowledged' : 'Acknowledgment required'}</span>}</div>
        <button type="button" className="go-ann-title" disabled={busy} onClick={() => openLinked(item)}>{item.title}<ArrowRight size={18} /></button>
        <p className="go-ann-excerpt">{item.message}</p><p className="go-ann-meta">{item.author_name} · {dateLabel(item.published_at || item.updated_at)}</p>
        {manage && <><p className="go-ann-meta">{audienceLabel(item)}{item.expires_at ? ` · Expires ${dateLabel(item.expires_at)}` : ''}</p><div className="go-ann-card-actions">{item.status !== 'archived' && <button type="button" onClick={() => setEditor(item)}><Pencil size={14} />Edit</button>}{item.published_at && <button type="button" onClick={() => setReport(item)}><Eye size={14} />Read report</button>}{item.status !== 'archived' && <button type="button" onClick={() => setArchive(item)}><Archive size={14} />Archive</button>}</div></>}
      </article>)}</div>}
    {editor && <AnnouncementEditor existing={editor === 'new' ? undefined : editor} onClose={() => setEditor(null)} onSaved={item => { setEditor(null); setFilter(item.status); void load(); void refreshNotifications(); }} />}
    {detail && <AnnouncementDetail item={detail} preview={manage} onClose={() => { setDetail(null); navigate(`${manage ? 'administration' : 'personal'}/announcements`); }} onChange={update} />}
    {report && <Readership item={report} onClose={() => setReport(null)} />}
    {archive && <Dialog className="go-ann-dialog" busy={busy} title="Archive announcement?" onClose={() => { if (!busy) setArchive(null); }}><div className="go-ann-dialog-body"><p>“{archive.title}” will be hidden from employees. Its record and readership report will remain available to admins.</p>{error && <p className="go-ann-error" role="alert">{error}</p>}<div className="go-ann-card-actions"><button type="button" disabled={busy} onClick={() => setArchive(null)}>Cancel</button><button type="button" className="go-ann-primary" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await api.archiveAnnouncement(archive); setArchive(null); await load(); await refreshNotifications(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>{busy ? 'Archiving…' : 'Archive announcement'}</button></div></div></Dialog>}
  </div>;
}

export function AnnouncementWidget({ onViewAll }: { onViewAll: () => void }) {
  const { refreshNotifications } = useAuth();
  const [items, setItems] = useState<AnnouncementView[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<AnnouncementView | null>(null);
  useEffect(() => { let active = true; api.getAnnouncements().then(data => { if (active) setItems(data.filter(item => !expired(item)).sort((a, b) => Number(b.requires_acknowledgment && !b.acknowledged_at) - Number(a.requires_acknowledgment && !a.acknowledged_at) || Number(!b.read_at) - Number(!a.read_at)).slice(0, 3)); }).catch(() => { if (active) setError('Company updates could not load. Open Announcements to try again.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const update = (item: AnnouncementView) => { setDetail(item); setItems(previous => previous.map(a => a.id === item.id ? item : a)); void refreshNotifications(); };
  const activeItems = items.filter(item => !expired(item));
  return <section className="go-ann-widget go-surface" aria-label="Company updates"><header><div><span className="go-ann-widget-icon"><Megaphone size={19} /></span><h2>{activeItems.some(item => item.requires_acknowledgment && !item.acknowledged_at) ? 'Needs your attention' : 'Company updates'}</h2></div><button type="button" onClick={onViewAll}>View all <ArrowRight size={15} /></button></header>
    {loading ? <p className="go-ann-widget-note" role="status">Loading updates…</p> : error ? <p className="go-ann-widget-note" role="alert">{error}</p> : !activeItems.length ? <p className="go-ann-widget-note">You’re up to date. New announcements will appear here.</p> : <div className="go-ann-widget-list">{activeItems.map(item => <button key={item.id} type="button" disabled={busy} onClick={async () => { setBusy(true); try { update(await api.readAnnouncement(item)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><span className={`go-ann-dot ${item.read_at ? 'is-read' : ''}`} aria-label={item.read_at ? 'Read' : 'Unread'} /><span><strong>{item.title}</strong><small>{item.category}{item.pinned ? ' · Pinned' : ''}{item.requires_acknowledgment && !item.acknowledged_at ? ' · Acknowledgment required' : ''}</small></span><ArrowRight size={16} /></button>)}</div>}
    {detail && <AnnouncementDetail item={detail} onClose={() => setDetail(null)} onChange={update} />}
  </section>;
}
