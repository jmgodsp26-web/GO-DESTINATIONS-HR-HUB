import { readUpload } from '../../utils/files';
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, EmployeeDocument } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  FolderOpen,
  FileText,
  Upload,
  Trash2,
  X,
  FileCheck,
  Download,
  AlertCircle,
  Clock,
  Shield,
  Loader2,
  Paperclip,
} from 'lucide-react';

interface EmployeeDocumentsModalProps {
  employee: UserProfile;
  onClose: () => void;
}

export const EmployeeDocumentsModal: React.FC<EmployeeDocumentsModalProps> = ({
  employee,
  onClose,
}) => {
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<EmployeeDocument | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  // Upload Form state
  const [docName, setDocName] = useState('');
  const [category, setCategory] = useState<EmployeeDocument['category']>('Contract');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const docs = await api.getEmployeeDocuments(employee.id);
      setDocuments(docs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load employee documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [employee.id]);

  const readSequence = useRef(0);
  const selectFile = async (file: File) => {
    const sequence = ++readSequence.current;
    setFileBase64(''); setSelectedFile(file); setError(null);
    try {
      const data = await readUpload(file);
      if (sequence !== readSequence.current) return;
      setFileBase64(data);
      if (!docName) setDocName(file.name.replace(/\.[^/.]+$/, ''));
    } catch (err: any) {
      if (sequence === readSequence.current) {setError(err.message); setSelectedFile(null);}
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) void selectFile(e.target.files[0]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) void selectFile(e.dataTransfer.files[0]);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !fileBase64) {setError('Select a file and wait until it finishes loading.'); return;}
    if (!docName.trim()) {
      setError('Please provide a document title or name');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const sizeStr = selectedFile ? formatFileSize(selectedFile.size) : '0 Bytes';
      const ext = selectedFile ? selectedFile.name.split('.').pop() : 'pdf';
      const fullDocName = docName.includes('.') ? docName : `${docName}.${ext || 'pdf'}`;

      const newDoc = await api.uploadEmployeeDocument(employee.id, {
        name: fullDocName,
        category,
        file_size: sizeStr,
        file_data: fileBase64 || undefined,
      });

      setDocuments((prev) => [newDoc, ...prev]);
      showToast({
        type: 'success',
        title: 'Document Saved',
        message: `"${fullDocName}" added to ${employee.full_name}'s official record.`,
      });
      setDocName('');
      setSelectedFile(null);
      setFileBase64('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmDeleteDoc = async () => {
    if (!deletingDoc) return;
    const docId = deletingDoc.id;
    const docName = deletingDoc.name;
    setIsDeletingDoc(true);
    try {
      await api.deleteEmployeeDocument(employee.id, docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      showToast({
        type: 'info',
        title: 'Document Deleted',
        message: `"${docName}" was removed.`,
      });
      setDeletingDoc(null);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Deletion Failed',
        message: err.message || 'Failed to delete document',
      });
    } finally {
      setIsDeletingDoc(false);
    }
  };

  const handleDownload = (doc: EmployeeDocument) => {
    showToast({
      type: 'info',
      title: 'Downloading Document',
      message: `Fetching ${doc.name}...`,
    });
    if (doc.file_data) {
      const link = document.createElement('a');
      link.href = doc.file_data;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const element = document.createElement('a');
      const file = new Blob([`Confidential Document Content for: ${doc.name}\nEmployee: ${employee.full_name} (${employee.employee_id})\nUploaded: ${new Date(doc.uploaded_at).toLocaleString()}`], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = doc.name.endsWith('.txt') ? doc.name : `${doc.name}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  };

  const getCategoryColor = (cat: EmployeeDocument['category']) => {
    switch (cat) {
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">Employee Documents</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  <Shield className="w-3 h-3 mr-1" /> Admin Access Only
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Confidential HR records for <span className="font-semibold text-slate-800">{employee.full_name}</span> ({employee.employee_id})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center text-xs text-rose-700 space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload Form Box */}
          <form onSubmit={handleUpload} className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
              <Upload className="w-4 h-4 text-indigo-600" />
              <span>Upload New Confidential Document</span>
            </h4>

            {/* Drag & Drop zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-50/50'
                  : selectedFile
                  ? 'border-emerald-400 bg-emerald-50/40'
                  : 'border-slate-300 hover:border-indigo-400 bg-white'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx"
              />
              {selectedFile ? (
                <div className="flex items-center justify-center space-x-2 text-emerald-800">
                  <FileCheck className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-bold">{selectedFile.name}</span>
                  <span className="text-[10px] text-emerald-600">({formatFileSize(selectedFile.size)})</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs text-slate-700 font-medium">
                    <span className="text-indigo-600 font-semibold underline">Click to choose a file</span> or drag and drop here
                  </p>
                  <p className="text-[11px] text-slate-400">PDF, Word (.doc, .docx), Images, or Excel files (up to 450 KB)</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Document Title / Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Employment Contract 2026"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-hidden bg-white text-slate-900 font-medium transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Document Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full text-xs px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-hidden bg-white text-slate-900 font-medium transition-all"
                >
                  <option value="Contract">Employment Contract</option>
                  <option value="ID Proof">ID Proof / Passport</option>
                  <option value="Resume">Resume / CV</option>
                  <option value="Certificate">Certificate / License</option>
                  <option value="Review">Performance Review</option>
                  <option value="Other">Other Confidential File</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={uploading || (!docName.trim() && !selectedFile)}
                className="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Save Document</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Existing Documents List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span>Attached Confidential Documents ({documents.length})</span>
            </h4>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Loading confidential documents...</span>
              </div>
            ) : documents.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600">No documents uploaded yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Use the upload section above to attach contracts, certifications, or IDs.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center space-x-3 min-w-0 pr-4">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                        <FileText className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-xs font-bold text-slate-900 truncate">{doc.name}</p>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getCategoryColor(
                              doc.category
                            )}`}
                          >
                            {doc.category}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-0.5">
                          <span className="font-mono text-[10px]">{doc.file_size}</span>
                          <span>•</span>
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                          </span>
                          <span>•</span>
                          <span>Uploaded by {doc.uploaded_by_name}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDownload(doc)}
                        title="Download Document"
                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingDoc(doc)}
                        title="Delete Document"
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Delete Document Confirmation Modal */}
      {deletingDoc && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/60">
              <div className="flex items-center space-x-2 text-rose-700">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-sm font-bold">Delete Document</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingDoc(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete document{' '}
                <strong className="text-slate-900 font-semibold">{deletingDoc.name}</strong>?
              </p>
              <div className="flex items-center justify-end space-x-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setDeletingDoc(null)}
                  disabled={isDeletingDoc}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteDoc}
                  disabled={isDeletingDoc}
                  className="px-3.5 py-2 text-xs font-semibold bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeletingDoc ? 'Deleting...' : 'Delete'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
