import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LeaveBalance, EmployeeDocument } from '../../types';
import { api } from '../../services/api';
import {
  User,
  Mail,
  Phone,
  Building,
  Briefcase,
  Calendar,
  Shield,
  ShieldCheck,
  Lock,
  BadgePercent,
  CheckCircle2,
  FolderOpen,
  FileText,
  Download,
} from 'lucide-react';

export const EmployeeProfile: React.FC = () => {
  const { user } = useAuth();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadProfileData() {
      try {
        const [bal, docs] = await Promise.all([
          api.getLeaveBalances(),
          api.getMyDocuments().catch(() => []),
        ]);
        setBalances(bal);
        setDocuments(docs || []);
      } catch (err) {
        console.error('Failed to load profile data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadProfileData();
  }, []);

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-slate-800 to-indigo-900 px-6 py-4 flex items-end">
          <div className="flex items-center space-x-2 text-white/80 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Verified Employee Profile • Active Record</span>
          </div>
        </div>

        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-12 sm:-mt-14 mb-4 gap-4">
            <div className="flex items-end space-x-4">
              {user.avatar_url && user.avatar_url.trim() ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover border-4 border-white shadow-md bg-white shrink-0"
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-[#3A5D83] text-white flex items-center justify-center font-bold text-2xl border-4 border-white shadow-md shrink-0">
                  {user.full_name
                    ? user.full_name
                        .split(' ')
                        .filter(Boolean)
                        .map((n) => n[0])
                        .join('')
                        .substring(0, 2)
                    : 'GD'}
                </div>
              )}
              <div className="mb-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                  {user.full_name}
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 font-medium">{user.job_title}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-start sm:self-end mb-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                user.role === 'admin'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {user.role === 'admin' ? 'Administrator' : 'Standard Employee'}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                {user.status === 'active' ? 'Active Status' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Security Notice: Read-only */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center space-x-2 text-xs text-slate-600">
            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              Profile and HR employment records are managed by the HR Administration team. Contact HR for personal detail updates.
            </span>
          </div>
        </div>
      </div>

      {/* Information Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Employment Information Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center space-x-2 pb-3 mb-4 border-b border-slate-200">
            <Briefcase className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Employment Details</h2>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-medium">Employee ID:</span>
              <span className="font-mono font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                {user.employee_id}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-t border-slate-100">
              <span className="text-slate-500 font-medium">Department:</span>
              <span className="font-semibold text-slate-900">{user.department}</span>
            </div>

            <div className="flex justify-between items-center py-1 border-t border-slate-100">
              <span className="text-slate-500 font-medium">Job Title / Role:</span>
              <span className="font-semibold text-slate-900">{user.job_title}</span>
            </div>

            <div className="flex justify-between items-center py-1 border-t border-slate-100">
              <span className="text-slate-500 font-medium">Date Joined Company:</span>
              <span className="font-semibold text-slate-900">
                {new Date(user.date_joined).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-t border-slate-100">
              <span className="text-slate-500 font-medium">Employment Type:</span>
              <span className="font-semibold text-slate-900">Full-Time Regular</span>
            </div>
          </div>
        </div>

        {/* Contact Information Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center space-x-2 pb-3 mb-4 border-b border-slate-200">
            <Mail className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Contact Information</h2>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-medium">Corporate Email:</span>
              <span className="font-semibold text-slate-900">{user.email}</span>
            </div>

            <div className="flex justify-between items-center py-1 border-t border-slate-100">
              <span className="text-slate-500 font-medium">Work Phone:</span>
              <span className="font-semibold text-slate-900">{user.phone}</span>
            </div>

            <div className="flex justify-between items-center py-1 border-t border-slate-100">
              <span className="text-slate-500 font-medium">Office Location:</span>
              <span className="font-semibold text-slate-900">Headquarters - Floor 4</span>
            </div>

            <div className="flex justify-between items-center py-1 border-t border-slate-100">
              <span className="text-slate-500 font-medium">Work Authorization:</span>
              <span className="font-semibold text-emerald-700 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified</span>
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-t border-slate-100">
              <span className="text-slate-500 font-medium">System Permissions:</span>
              <span className="font-semibold text-slate-900 capitalize">{user.role} Access</span>
            </div>
          </div>
        </div>
      </div>

      {/* Leave Entitlements Summary Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center space-x-2 pb-3 mb-4 border-b border-slate-200">
          <Calendar className="w-4 h-4 text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-900">Current Year Leave Entitlements</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {balances.map((bal) => {
            const remaining = bal.allocated_days - bal.used_days;
            return (
              <div key={bal.id} className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-900">{bal.leave_type}</span>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[11px] font-medium">
                    {bal.allocated_days} days allocated
                  </span>
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-slate-900">{remaining}</span>
                  <span className="text-slate-500 font-medium">days remaining</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
                  <span>Used: {bal.used_days} days</span>
                  <span>Allocation: {bal.allocated_days} days</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Employee Confidential HR Documents Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
          <div className="flex items-center space-x-2">
            <FolderOpen className="w-4 h-4 text-[#365c84]" />
            <h2 className="text-sm font-bold text-slate-900">Confidential HR Documents & Records</h2>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
            {documents.length} {documents.length === 1 ? 'file' : 'files'}
          </span>
        </div>

        {documents.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">No documents on file</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Official company contracts, tax certificates, and identification files provided by HR will appear here.
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

              const handleDownload = () => {
                if (doc.file_data) {
                  const link = document.createElement('a');
                  link.href = doc.file_data;
                  link.download = doc.name;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                } else {
                  const element = document.createElement('a');
                  const file = new Blob([`Official Record: ${doc.name}\nEmployee: ${user.full_name} (${user.employee_id})\nUploaded: ${new Date(doc.uploaded_at).toLocaleString()}`], { type: 'text/plain' });
                  element.href = URL.createObjectURL(file);
                  element.download = doc.name.endsWith('.txt') ? doc.name : `${doc.name}.txt`;
                  document.body.appendChild(element);
                  element.click();
                  document.body.removeChild(element);
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
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getCategoryStyle(doc.category)}`}>
                          {doc.category}
                        </span>
                        <span className="text-[10px] text-slate-400">{doc.file_size}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 truncate" title={doc.name}>
                        {doc.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">By {doc.uploaded_by_name}</span>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="inline-flex items-center space-x-1 text-[11px] font-semibold text-[#3A5D83] hover:text-[#2F4D6D] hover:underline"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </button>
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
