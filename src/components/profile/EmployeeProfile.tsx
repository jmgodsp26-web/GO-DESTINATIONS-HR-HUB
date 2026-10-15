import { DocumentActions } from '../documents/DocumentActions';
import './employee-profile.css';
import { employeeCalendar } from '../../utils/employeeCalendar';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LeaveBalance, EmployeeDocument } from '../../types';
import { api } from '../../services/api';
import { Mail, Briefcase, Calendar, Lock, Globe2, FolderOpen, FileText, Download } from 'lucide-react';

const ProfileField = ({ label, value }: { label: string; value?: string }) => (
  <div className="go-profile-field"><dt>{label}</dt><dd className={!value ? 'is-empty' : ''}>{value || 'Not provided'}</dd></div>
);
const joinedDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value.slice(0, 10) + 'T12:00:00');
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

export const EmployeeProfile: React.FC = () => {
  const { user } = useAuth();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [balanceError, setBalanceError] = useState(false);
  const [documentError, setDocumentError] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadProfileData() {
      try {
        const [bal, docs] = await Promise.allSettled([api.getLeaveBalances(), api.getMyDocuments()]);
        if (bal.status === 'fulfilled') setBalances(bal.value);
        else setBalanceError(true);
        if (docs.status === 'fulfilled') setDocuments(docs.value || []);
        else setDocumentError(true);
      } catch (err: any) {
        if (!err?.message?.includes('Session expired') && !err?.message?.includes('token')) {
          console.error('Failed to load profile data:', err);
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadProfileData();
  }, []);

  if (!user) return null;

  return (
    <div className="go-profile">
      <header className="go-profile-hero">
        <div className="go-profile-accent" aria-hidden="true" />
        <div className="go-profile-identity">
          <div className="go-profile-avatar">
            {user.avatar_url?.trim() ? <img src={user.avatar_url} alt={user.full_name} /> :
              <span>{user.full_name?.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2) || 'GO'}</span>}
          </div>
          <div className="go-profile-intro">
            <p className="go-profile-eyebrow">MY PROFILE</p>
            <h1 className="go-profile-name">{user.full_name || 'Employee profile'}</h1>
            <p className="go-profile-subtitle">{[user.job_title, user.department].filter(Boolean).join(' · ') || 'Your employee details'}</p>
            <div className="go-profile-badges">
              <span>{user.role === 'admin' ? 'Admin' : 'Employee'}</span>
              <span className={user.status === 'active' ? 'is-active' : 'is-disabled'}><i aria-hidden="true" />{user.status === 'active' ? 'Active' : 'Disabled'}</span>
              {user.employee_id && <span className="go-profile-id">{user.employee_id}</span>}
            </div>
          </div>
        </div>
        <div className="go-profile-notice"><Lock size={15} aria-hidden="true" /><p>Need to update your details? Contact HR.</p></div>
      </header>

      <div className="go-profile-details">
        <section className="go-profile-card" aria-labelledby="profile-employment">
          <div className="go-profile-section-title"><span><Briefcase size={19} /></span><h2 id="profile-employment">Employment</h2></div>
          <dl>
            <ProfileField label="Employee ID" value={user.employee_id} />
            <ProfileField label="Department" value={user.department} />
            <ProfileField label="Job title" value={user.job_title} />
            <ProfileField label="Date joined" value={joinedDate(user.hire_date || user.date_joined)} />
          </dl>
        </section>
        <section className="go-profile-card" aria-labelledby="profile-contact">
          <div className="go-profile-section-title"><span><Mail size={19} /></span><h2 id="profile-contact">Contact</h2></div>
          <dl>
            <ProfileField label="Company email" value={user.email} />
            <ProfileField label="Work phone" value={user.phone} />
            <ProfileField label="Account access" value={user.role === 'admin' ? 'Administrator' : 'Employee'} />
          </dl>
        </section>
        <section className="go-profile-card" aria-labelledby="profile-location">
          <div className="go-profile-section-title"><span><Globe2 size={19} /></span><h2 id="profile-location">Location & Holidays</h2></div>
          <dl>
            <ProfileField label="Country" value={user.country} />
            <ProfileField label="State / Province" value={user.region} />
            <ProfileField label="Holiday calendar" value={employeeCalendar(user).country || 'Company-wide only'} />
          </dl>
          <p className="go-profile-footnote">Your holiday calendar can differ from the country where you work.</p>
        </section>
      </div>

      <section className="go-profile-card go-profile-leave" aria-labelledby="profile-leave">
        <div className="go-profile-section-title"><span><Calendar size={19} /></span><div><h2 id="profile-leave">Leave balances</h2><p>Your available days, at a glance.</p></div></div>
        {isLoading ? <p role="status" className="go-profile-empty">Loading leave balances…</p> :
          balanceError ? <p role="alert" className="go-profile-empty">Could not load leave balances. Please refresh to try again.</p> :
          balances.length === 0 ? <p className="go-profile-empty">No leave allowances assigned yet. Contact HR for details.</p> :
          <div className="go-profile-balances">{balances.map(bal => {
            const remaining = bal.allocated_days - bal.used_days;
            const availablePercent = bal.allocated_days > 0 ? Math.min(100, Math.max(0, remaining / bal.allocated_days * 100)) : 0;
            return <article key={bal.id} className="go-profile-balance">
              <h3>{bal.leave_type}</h3>
              <div className="go-profile-balance-number"><strong>{remaining}</strong><span>days remaining</span></div>
              <div className="go-profile-balance-track" aria-hidden="true"><span style={{ width: availablePercent + '%' }} /></div>
              <div className="go-profile-balance-meta"><span><b>{bal.used_days}</b> used</span><span><b>{bal.allocated_days}</b> allocated</span></div>
            </article>;
          })}</div>}
      </section>

      {/* Employee Confidential Documents Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
          <div className="flex items-center space-x-2">
            <FolderOpen className="w-4 h-4 text-[#3A5D83]" />
            <h2 className="text-sm font-bold text-slate-900">My documents</h2>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
            {isLoading || documentError ? '—' : documents.length} {documents.length === 1 ? 'file' : 'files'}
          </span>
        </div>

        {isLoading ? <p className="go-profile-empty" role="status">Loading documents…</p> :
          documentError ? <p className="go-profile-empty" role="alert">Could not load documents. Please refresh to try again.</p> :
          documents.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">No documents on file</p>
            <p className="text-[12px] text-slate-400 mt-0.5">
              Documents shared with you by HR will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {documents.map((doc) => {
              const getCategoryStyle = (cat: EmployeeDocument['category']) => {
                switch (cat) {
                  case 'Contract':
                    return 'bg-blue-50 text-blue-700 border-blue-200';
                  case 'ID Proof':
                    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  case 'Resume':
                    return 'bg-purple-50 text-purple-700 border-purple-200';
                  case 'Certificate':
                    return 'bg-amber-50 text-amber-700 border-amber-200';
                  case 'Review':
                    return 'bg-indigo-50 text-indigo-700 border-indigo-200';
                  default:
                    return 'bg-slate-50 text-slate-700 border-slate-200';
                }
              };


              return (
                <div
                  key={doc.id}
                  className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-white hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-[#3A5D83]/10 text-[#3A5D83] flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[12px] font-semibold border ${getCategoryStyle(doc.category)}`}>
                          {doc.category}
                        </span>
                        <span className="text-[12px] text-slate-400">{doc.file_size}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 truncate" title={doc.name}>
                        {doc.name}
                      </h4>
                      <p className="text-[12px] text-slate-400 mt-1">
                        Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-[12px] text-slate-400">By {doc.uploaded_by_name}</span>
                    <DocumentActions doc={doc} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
