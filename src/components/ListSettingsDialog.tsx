import { useState } from 'react';
import { ListWithRole } from '../types';
import { fetchWithAuth } from '../lib/api';

interface ListSettingsDialogProps {
  list: ListWithRole;
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: (updatedList: ListWithRole['list']) => void;
}

export default function ListSettingsDialog({ 
  list, 
  isOpen, 
  onClose, 
  onSettingsUpdated 
}: ListSettingsDialogProps) {
  const [title, setTitle] = useState(list.list.title);
  const [sortingMode, setSortingMode] = useState(list.list.sorting_mode);
  const [votingPolicy, setVotingPolicy] = useState(list.list.voting_policy);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  if (!isOpen) return null;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!list.list.id) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      const response = await fetchWithAuth(`/api/lists/${list.list.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          sorting_mode: sortingMode,
          voting_policy: votingPolicy
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update list settings');
      }
      
      const updatedList = await response.json();
      onSettingsUpdated(updatedList);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update list settings');
      console.error('Error updating list settings:', err);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleReset = () => {
    setTitle(list.list.title);
    setSortingMode(list.list.sorting_mode);
    setVotingPolicy(list.list.voting_policy);
    setError(null);
  };
  
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
            <h3 className="text-lg font-semibold text-gray-900">List Settings</h3>
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
          
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  List Title
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              {/* Sorting Mode */}
              <div>
                <label htmlFor="sorting-mode" className="block text-sm font-medium text-gray-700 mb-1">
                  Sorting Mode
                </label>
                <select
                  id="sorting-mode"
                  value={sortingMode}
                  onChange={(e) => setSortingMode(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="updated">Last Updated</option>
                  <option value="created">Created Date</option>
                  <option value="manual">Manual (Drag & Drop)</option>
                  <option value="vote">Most Votes</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  How items should be sorted in the list
                </p>
              </div>
              
              {/* Voting Policy */}
              <div>
                <label htmlFor="voting-policy" className="block text-sm font-medium text-gray-700 mb-1">
                  Voting Policy
                </label>
                <select
                  id="voting-policy"
                  value={votingPolicy}
                  onChange={(e) => setVotingPolicy(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="open">Open - Anyone can vote</option>
                  <option value="restricted">Restricted - Only signed-in users can vote</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Who is allowed to vote on items
                </p>
              </div>
              
              {/* Error message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  <p className="text-sm">{error}</p>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Reset
              </button>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
