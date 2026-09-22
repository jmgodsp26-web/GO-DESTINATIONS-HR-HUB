import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { EmployeeDocument, UserProfile } from '../../types';
import { api } from '../../services/api';
import {
  FolderOpen,
  FileText,
  Download,
  Search,
  Filter,
  Lock,
  Building,
  Calendar,
  Tag,
  ShieldCheck,
  CheckCircle2,
  FileSpreadsheet,
  FileCode,
  FileCheck,
  Clock,
} from 'lucide-react';

interface DocumentsViewProps {
  onNavigateTab?: (tab: string) => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('All');

  const isAdmin = user?.role === 'admin';

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isAdmin) {
        // Load all employee documents + employee directory
        const allEmps = await api.getAllEmployees();
        setEmployees(allEmps);

        // Fetch documents for all employees in parallel
        const docPromises = allEmps.map((emp) =>
          api.getEmployeeDocuments(emp.id).catch(() => [])
        );
        const docsArrays = await Promise.all(docPromises);
        const flattened = docsArrays.flat();
        setDocuments(flattened);
      } else {
        // Load current user's confidential documents
        const myDocs = await api.getMyDocuments();
        setDocuments(myDocs || []);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  if (!user) return null;

  const categories = ['All', 'Contract', 'ID Proof', 'Resume', 'Certificate', 'Review', 'Other'];

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.uploaded_by_name && doc.uploaded_by_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'All' || doc.category === selectedCategory;
    const matchesEmployee = !isAdmin || selectedEmployeeId === 'All' || doc.employee_id === selectedEmployeeId;

    return matchesSearch && matchesCategory && matchesEmployee;
  });

  const getCategoryBadgeClass = (category: EmployeeDocument['category']) => {
    switch (category) {
      case 'Contract':
        return 'bg-blue-50 text-blue-700 border-blue-200/80';
      case 'ID Proof':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
      case 'Resume':
        return 'bg-purple-50 text-purple-700 border-purple-200/80';
      case 'Certificate':
        return 'bg-amber-50 text-amber-700 border-amber-200/80';
      case 'Review':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200/80';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200/80';
    }
  };

  const handleDownload = (doc: EmployeeDocument) => {
    showToast({
      type: 'info',
      title: 'Downloading Document',
      message: `Downloading ${doc.name}...`,
    });

    if (doc.file_data) {
      const link = document.createElement('a');
      link.href = doc.file_data;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const content = `GO Destinations HR Hub - Document Record\n\nDocument: ${doc.name}\nCategory: ${doc.category}\nFile Size: ${doc.file_size}\nUploaded: ${new Date(doc.uploaded_at).toLocaleString()}\nUploader: ${doc.uploaded_by_name}\n`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.name.endsWith('.txt') ? doc.name : `${doc.name}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isAdmin ? 'Corporate Archive' : 'Confidential Records'}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-slate-500">GO Destinations HR</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 tracking-tight">HR Documents Library</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {isAdmin
              ? 'Access, search, and manage official employment records, contracts, and certifications across all staff.'
              : 'Access your verified employment contracts, ID verifications, performance reviews, and certificates.'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100/80 text-slate-700 border border-slate-200/80">
            <Lock className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            256-bit Encrypted Storage
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by file name or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/60 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 font-medium transition-all"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                    active
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/70'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Admin Employee Filter */}
        {isAdmin && employees.length > 0 && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-700 shrink-0">Filter by Employee:</span>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
            >
              <option value="All">All Employees ({documents.length} files)</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.department} - {emp.employee_id})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Documents Grid / Table */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-xs">
          <div className="space-y-4">
            <div className="h-4 bg-slate-100 rounded w-1/4 animate-pulse" />
            <div className="h-10 bg-slate-100 rounded-xl w-full animate-pulse" />
            <div className="h-10 bg-slate-100 rounded-xl w-full animate-pulse" />
            <div className="h-10 bg-slate-100 rounded-xl w-full animate-pulse" />
          </div>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <FolderOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No documents found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            {searchQuery || selectedCategory !== 'All'
              ? 'No documents matched your current search or category filter. Try clearing your filters.'
              : 'There are no official HR documents uploaded to your employee record yet.'}
          </p>
          {(searchQuery || selectedCategory !== 'All') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setSelectedEmployeeId('All');
              }}
              className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/60 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-800">Archived Documents</span>
              <span className="text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                {filteredDocs.length} {filteredDocs.length === 1 ? 'file' : 'files'}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">Official HR Records</span>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="px-5 py-3.5">Document Name</th>
                  <th className="px-5 py-3.5">Category</th>
                  {isAdmin && <th className="px-5 py-3.5">Employee</th>}
                  <th className="px-5 py-3.5">Date Uploaded</th>
                  <th className="px-5 py-3.5">Size</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocs.map((doc) => {
                  const empMatch = isAdmin ? employees.find((e) => e.id === doc.employee_id) : null;
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block truncate max-w-xs sm:max-w-sm" title={doc.name}>
                              {doc.name}
                            </span>
                            <span className="text-[11px] text-slate-400 block">
                              Uploaded by {doc.uploaded_by_name || 'HR Admin'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getCategoryBadgeClass(doc.category)}`}>
                          {doc.category}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-3.5 text-slate-700">
                          {empMatch ? (
                            <div className="flex items-center space-x-2">
                              {empMatch.avatar_url && empMatch.avatar_url.trim() ? (
                                <img
                                  src={empMatch.avatar_url}
                                  alt={empMatch.full_name}
                                  className="w-6 h-6 rounded-full object-cover border border-slate-200"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-[#3A5D83]/10 text-[#3A5D83] flex items-center justify-center font-bold text-[9px] border border-[#3A5D83]/20 shrink-0">
                                  {empMatch.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'EM'}
                                </div>
                              )}
                              <span className="font-medium text-slate-900 truncate max-w-[120px]">
                                {empMatch.full_name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">ID: {doc.employee_id}</span>
                          )}
                        </td>
                      )}
                      <td className="px-5 py-3.5 text-slate-600 tabular-nums font-medium">
                        {new Date(doc.uploaded_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 tabular-nums font-mono text-[11px]">
                        {doc.file_size}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDownload(doc)}
                          className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-semibold transition-colors shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-500" />
                          <span>Download</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards Stack */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredDocs.map((doc) => (
              <div key={doc.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-slate-900 text-xs truncate" title={doc.name}>
                      {doc.name}
                    </span>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${getCategoryBadgeClass(doc.category)}`}>
                    {doc.category}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span className="font-mono text-[10px]">{doc.file_size}</span>
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                  </span>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handleDownload(doc)}
                    className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 rounded-xl text-xs font-semibold transition-colors shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Download File</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
