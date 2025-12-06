import { useState } from 'react';
import { ListWithRole } from '../types';

interface ShareDialogProps {
  list: ListWithRole;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareDialog({ list, isOpen, onClose }: ShareDialogProps) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'view' | 'edit'>('view');
  
  if (!isOpen) return null;

  const viewUrl = `${window.location.origin}/l/${list.list.view_token}`;
  const editUrl = list.list.edit_token ? `${window.location.origin}/l/${list.list.edit_token}` : null;
  const hasEditPermission = list.role === 'owner' || list.role === 'collaborator' || list.role === 'editor';
  const showTabs = editUrl && hasEditPermission;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedUrl(text);
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  };

  const currentUrl = activeTab === 'view' ? viewUrl : (editUrl || viewUrl);
  const currentLabel = activeTab === 'view' ? 'View Link' : 'Edit Link';
  const currentDescription = activeTab === 'view' 
    ? 'Anyone with this link can view the list'
    : 'Anyone with this link can edit the list';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />
        
        {/* Dialog */}
        <div className="relative bg-white rounded-xl shadow-lg border border-gray-200 max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Share List</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 p-1 rounded hover:bg-gray-100"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-4">
            {/* Segment Control (Tab Switcher) */}
            {showTabs && (
              <div className="bg-gray-100 p-1 rounded-lg flex mb-4">
                <button
                  onClick={() => setActiveTab('view')}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'view'
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  View Link
                </button>
                <button
                  onClick={() => setActiveTab('edit')}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'edit'
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Edit Link
                </button>
              </div>
            )}
            
            {/* Current Link */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {currentLabel}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={currentUrl}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50"
                />
                <button
                  onClick={() => handleCopy(currentUrl)}
                  className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {copiedUrl === currentUrl ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {currentDescription}
              </p>
            </div>
            
            {/* QR Code for quick sharing */}
            <div className="pt-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                QR Code for Quick Sharing
              </label>
              <div className="flex flex-col items-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(currentUrl)}`}
                  alt="QR Code for sharing"
                  className="w-40 h-40 border border-gray-200 rounded-lg p-2"
                />
                <p className="mt-2 text-xs text-gray-500 text-center">
                  Scan this QR code to open the list on mobile devices
                </p>
              </div>
            </div>

            {/* Role information */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Your role: <span className="font-medium capitalize">{list.role}</span>
              </p>
              {list.role === 'owner' && (
                <p className="mt-1 text-xs text-gray-500">
                  As the owner, you can add collaborators and change list settings.
                </p>
              )}
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
