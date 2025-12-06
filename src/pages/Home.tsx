import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { List } from '../types';

export default function Home() {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const userData = await speed.auth.getCurrentUser();
      setUser(userData?.user || null);
      if (userData?.user) {
        fetchUserLists();
      } else {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const fetchUserLists = async () => {
    try {
      const response = await apiFetch('/api/lists');
      const data = await response.json();
      setLists(data);
    } catch (error) {
      console.error('Failed to fetch lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateList = async () => {
    if (!user) {
      speed.auth.login();
      return;
    }

    setCreating(true);
    try {
      const response = await apiFetch('/api/lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'My New List',
        }),
      });
      
      const list = await response.json();
      console.log('Created list:', list);
      // Navigate to the list view page with the edit token
      if (!list.edit_token) {
        console.error('No edit_token in list response:', list);
        alert('Failed to create list: No edit token returned');
        return;
      }
      navigate(`/l/${list.edit_token}`);
    } catch (error) {
      console.error('Failed to create list:', error);
      if (error instanceof Error) {
        alert(`Failed to create list: ${error.message}`);
      } else {
        alert('Failed to create list: Unknown error');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Collaborative Lists Made Simple
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Create, share, and collaborate on lists with friends, family, or colleagues.
          Vote on items, track progress, and get things done together.
        </p>
        <div className="mt-8">
          <button
            onClick={handleCreateList}
            disabled={creating}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Create Your First List'}
          </button>
        </div>
      </div>

      {/* Dashboard Section - Only for logged in users */}
      {user && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Lists</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading your lists...</p>
            </div>
          ) : lists.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">You haven't created any lists yet.</p>
              <button
                onClick={handleCreateList}
                disabled={creating}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Your First List'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {lists.map((list) => (
                <div
                  key={list.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/l/${list.view_token}`)}
                >
                  <h3 className="font-medium text-gray-900 mb-2 truncate">{list.title}</h3>
                  <div className="text-sm text-gray-500">
                    <p>Created: {new Date(list.created_at).toLocaleDateString()}</p>
                    <p>Last updated: {new Date(list.updated_at).toLocaleDateString()}</p>
                  </div>
                  <div className="mt-4 flex justify-between items-center">
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                      {list.owner_id === user.id ? 'Owner' : 'Collaborator'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/l/${list.edit_token}`);
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Features Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-blue-600 text-2xl mb-4">📝</div>
          <h3 className="font-bold text-lg mb-2">Create & Share</h3>
          <p className="text-gray-600">
            Create lists and share them with view-only or edit links. No accounts needed for collaborators.
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-blue-600 text-2xl mb-4">🗳️</div>
          <h3 className="font-bold text-lg mb-2">Vote & Prioritize</h3>
          <p className="text-gray-600">
            Let collaborators vote on items to help prioritize what's most important.
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-blue-600 text-2xl mb-4">🤝</div>
          <h3 className="font-bold text-lg mb-2">Real-time Collaboration</h3>
          <p className="text-gray-600">
            See changes instantly as collaborators add, edit, or vote on items.
          </p>
        </div>
      </div>
    </div>
  );
}
