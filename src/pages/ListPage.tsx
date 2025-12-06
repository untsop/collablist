import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TodoItem from '../components/TodoItem';
import ShareDialog from '../components/ShareDialog';
import ListSettingsDialog from '../components/ListSettingsDialog';
import ListHeader from '../components/ListHeader';
import { ListWithRole, Item, ItemsResponse } from '../types';
import { fetchWithAuth, setCollabToken } from '../lib/api';

export default function ListPage() {
  const { token } = useParams<{ token: string }>();
  const [listWithRole, setListWithRole] = useState<ListWithRole | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState('');
  const [newItemNote, setNewItemNote] = useState('');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [sseConnection, setSseConnection] = useState<EventSource | null>(null);
  const [sseStatus, setSseStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting');
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; photoUrl: string } | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const navigate = useNavigate();

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      const authData = await speed.auth.getCurrentUser();
      setCurrentUser(authData?.user || null);
    };
    fetchUser();
  }, []);

  // Fetch list data
  const fetchListData = useCallback(async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Fetch list with role
      const listResponse = await fetchWithAuth(`/api/lists/${token}`);
      const listData: ListWithRole = await listResponse.json();
      setListWithRole(listData);
      
      // Store edit token if we have edit access
      if (listData.list.edit_token && token === listData.list.edit_token) {
        setCollabToken(token);
      }
      
      // Fetch items
      if (!listData.list.id) {
        throw new Error('List ID is missing');
      }
      const itemsResponse = await fetchWithAuth(`/api/items/lists/${listData.list.id}/items`);
      if (!itemsResponse.ok) {
        throw new Error(`Failed to fetch items: ${itemsResponse.status} ${itemsResponse.statusText}`);
      }
      const itemsData: ItemsResponse = await itemsResponse.json();
      setItems(itemsData.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load list');
      console.error('Error fetching list:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial data fetch
  useEffect(() => {
    fetchListData();
  }, [fetchListData]);

  // Setup SSE connection
  useEffect(() => {
    if (!listWithRole || !listWithRole.list.id || !token) return;
    
    const connectSSE = () => {
      try {
        setSseStatus('connecting');
        // Include token as query parameter for SSE authentication
        const eventSource = new EventSource(`/api/sse/lists/${listWithRole.list.id}/events?token=${encodeURIComponent(token)}`);
        
        eventSource.addEventListener('update', (event) => {
          console.log('SSE update event received:', event.type, event.data);
          try {
            const data = JSON.parse(event.data);
            console.log('Parsed SSE data:', data);
            handleSSEEvent(data);
          } catch (err) {
            console.error('Error parsing SSE event:', err);
          }
        });
        
        // Also listen for 'message' events as a fallback
        eventSource.addEventListener('message', (event) => {
          console.log('SSE message event received:', event.type, event.data);
          try {
            const data = JSON.parse(event.data);
            console.log('Parsed SSE message data:', data);
            handleSSEEvent(data);
          } catch (err) {
            console.error('Error parsing SSE message event:', err);
          }
        });
        
        eventSource.addEventListener('system', (event) => {
          console.log('SSE system event received:', event.type, event.data);
        });
        
        eventSource.onopen = () => {
          setSseStatus('connected');
        };
        
        eventSource.onerror = (err) => {
          console.error('SSE connection error:', err);
          setSseStatus('offline');
          eventSource.close();
          // Attempt to reconnect after a delay
          setTimeout(connectSSE, 5000);
        };
        
        setSseConnection(eventSource);
        
        return () => {
          eventSource.close();
        };
      } catch (err) {
        console.error('Error setting up SSE:', err);
        setSseStatus('offline');
      }
    };
    
    const cleanup = connectSSE();
    return cleanup;
  }, [listWithRole]);

  // Handle SSE events
  const handleSSEEvent = useCallback((data: any) => {
    console.log('handleSSEEvent called with:', data);
    switch (data.type) {
      case 'list.updated':
        setListWithRole(prev => prev ? {
          ...prev,
          list: { ...prev.list, ...data.data }
        } : null);
        break;
        
      case 'item.created':
        setItems(prev => {
          // Check if item already exists
          if (prev.some(item => item.id === data.data.id)) {
            return prev;
          }
          // Use the full item data from server, preserving local has_voted state
          const existingItem = prev.find(item => item.id === data.data.id);
          const newItem = {
            ...data.data,
            vote_count: data.data.vote_count !== undefined ? data.data.vote_count : 0,
            has_voted: existingItem?.has_voted !== undefined ? existingItem.has_voted : false
          };
          return [...prev, newItem];
        });
        break;
        
      case 'item.updated':
        setItems(prev => prev.map(item => {
          if (item.id === data.data.id) {
            // Merge the full item data from server while preserving local has_voted state
            return {
              ...item,
              ...data.data,
              vote_count: data.data.vote_count !== undefined ? data.data.vote_count : item.vote_count,
              has_voted: item.has_voted // Preserve local vote state
            };
          }
          return item;
        }));
        break;
        
      case 'item.deleted':
        setItems(prev => prev.filter(item => item.id !== data.id));
        break;
        
      case 'vote.updated':
        setItems(prev => prev.map(item => {
          if (item.id === data.data.id) {
            // Use full item data from server, preserving local has_voted state
            return {
              ...item,
              ...data.data,
              has_voted: item.has_voted // Preserve local vote state
            };
          }
          return item;
        }));
        break;
        
      case 'items.reordered':
        // We'll refetch items to get the new order
        fetchListData();
        break;
        
      default:
        console.log('Unhandled SSE event:', data);
    }
  }, [fetchListData]);

  // Sort items based on list sorting mode
  const sortedItems = useCallback(() => {
    if (!listWithRole || items.length === 0) return items;
    
    const mode = listWithRole.list.sorting_mode;
    const itemsCopy = [...items];
    
    switch (mode) {
      case 'updated':
        return itemsCopy.sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        
      case 'created':
        return itemsCopy.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
      case 'manual':
        return itemsCopy.sort((a, b) => a.position - b.position);
        
      case 'vote':
        return itemsCopy.sort((a, b) => {
          const aVotes = a.vote_count || 0;
          const bVotes = b.vote_count || 0;
          if (bVotes !== aVotes) {
            return bVotes - aVotes;
          }
          // Tie-breaker: newer items first (by created_at)
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        
      default:
        return itemsCopy;
    }
  }, [items, listWithRole]);

  // Check if user can vote based on voting policy
  const canVote = useCallback(() => {
    if (!listWithRole) return false;
    
    const policy = listWithRole.list.voting_policy;
    
    if (policy === 'open') {
      return true; // Anyone can vote
    }
    
    if (policy === 'restricted') {
      return !!currentUser; // Only signed-in users can vote
    }
    
    return false;
  }, [listWithRole, currentUser]);

  // Check user permissions
  const getUserPermissions = useCallback(() => {
    if (!listWithRole) {
      return {
        canEdit: false,
        canDelete: false,
        canVote: false
      };
    }
    
    const role = listWithRole.role;
    const canEdit = role === 'owner' || role === 'collaborator' || role === 'editor';
    const canDelete = canEdit; // Same as edit permissions
    const canVotePermission = canVote();
    
    return { canEdit, canDelete, canVote: canVotePermission };
  }, [listWithRole, canVote]);

  // Handle adding new item
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newItemText.trim() || !listWithRole) return;
    
    try {
      const response = await fetchWithAuth(`/api/items/lists/${listWithRole.list.id}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: newItemText.trim(),
          note: newItemNote.trim() || undefined
        })
      });
      
      if (response.ok) {
        setNewItemText('');
        setNewItemNote('');
        // SSE will handle the update
      }
    } catch (err) {
      console.error('Error adding item:', err);
      alert('Failed to add item: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // Handle toggling item completion
  const handleToggleComplete = async (itemId: string, completed: boolean) => {
    try {
      await fetchWithAuth(`/api/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_completed: completed
        })
      });
      // SSE will handle the update
    } catch (err) {
      console.error('Error updating item:', err);
      alert('Failed to update item: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // Handle deleting item
  const handleDeleteItem = async (itemId: string) => {
    try {
      await fetchWithAuth(`/api/items/${itemId}`, {
        method: 'DELETE'
      });
      // SSE will handle the update
    } catch (err) {
      console.error('Error deleting item:', err);
      alert('Failed to delete item: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // Handle voting
  const handleVote = async (itemId: string) => {
    try {
      // Use the toggle endpoint (POST to vote/unvote)
      const response = await fetchWithAuth(`/api/votes/items/${itemId}/vote`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to vote');
      }
      
      const result = await response.json();
      const voted = result.voted; // true if vote was added, false if removed
      
      // Update local state immediately
      setItems(prev => prev.map(item => {
        if (item.id === itemId) {
          const currentVoteCount = item.vote_count || 0;
          const newVoteCount = voted ? currentVoteCount + 1 : Math.max(0, currentVoteCount - 1);
          return {
            ...item,
            vote_count: newVoteCount,
            has_voted: voted
          };
        }
        return item;
      }));
      
      // SSE will also send an update with the exact count
    } catch (err) {
      console.error('Error voting:', err);
      alert('Failed to vote: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // Handle fork list
  const handleForkList = async () => {
    if (!listWithRole || !listWithRole.list.id) return;
    
    try {
      const response = await fetchWithAuth(`/api/lists/${listWithRole.list.id}/fork`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fork list');
      }
      
      const newList = await response.json();
      // Redirect to the new list
      navigate(`/l/${newList.edit_token}`);
    } catch (err) {
      console.error('Error forking list:', err);
      alert('Failed to fork list: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // Handle list settings update
  const handleSettingsUpdated = (updatedList: ListWithRole['list']) => {
    setListWithRole(prev => prev ? {
      ...prev,
      list: updatedList
    } : null);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
    // Set drag image to be transparent
    const dragImage = document.createElement('div');
    dragImage.style.opacity = '0';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedItemId(null);
    setIsReordering(false);
  };

  const handleDrop = async (e: React.DragEvent, targetItemId: string) => {
    e.preventDefault();
    
    if (!draggedItemId || draggedItemId === targetItemId || !listWithRole || !listWithRole.list.id) {
      return;
    }
    
    // Check permissions
    const currentPermissions = getUserPermissions();
    if (!currentPermissions.canEdit) {
      return;
    }
    
    setIsReordering(true);
    
    try {
      // Get current item order
      const currentOrder = sortedItems().map(item => item.id);
      
      // Find positions of dragged and target items
      const draggedIndex = currentOrder.indexOf(draggedItemId);
      const targetIndex = currentOrder.indexOf(targetItemId);
      
      if (draggedIndex === -1 || targetIndex === -1) {
        return;
      }
      
      // Create new order by moving dragged item to target position
      const newOrder = [...currentOrder];
      const [draggedItem] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedItem);
      
      // Call API to reorder items
      const response = await fetchWithAuth(`/api/items/lists/${listWithRole.list.id}/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemIds: newOrder
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reorder items');
      }
      
      // SSE will handle the update
    } catch (err) {
      console.error('Error reordering items:', err);
      alert('Failed to reorder items: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsReordering(false);
      setDraggedItemId(null);
    }
  };

  // Handle login
  const handleLogin = () => {
    speed.auth.login();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-3 text-gray-600">Loading list...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-md w-full">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading List</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 w-full"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!listWithRole) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-md w-full">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">List Not Found</h3>
            <p className="text-gray-600 mb-4">The list you're looking for doesn't exist or you don't have access.</p>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 w-full"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const permissions = getUserPermissions();
  const sortedItemsList = sortedItems();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-6">
        {/* Header */}
        <ListHeader
          listWithRole={listWithRole}
          currentUser={currentUser}
          sseStatus={sseStatus}
          onShare={() => setShowShareDialog(true)}
          onSettings={() => setShowSettingsDialog(true)}
          onLogin={handleLogin}
          onForkList={handleForkList}
        />

        {/* Add Item Form - Prominent and easy to use */}
        {permissions.canEdit && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <form onSubmit={handleAddItem} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  placeholder="Add a new item..."
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!newItemText.trim()}
                  className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </button>
              </div>
              
              {newItemText.trim() && (
                <div>
                  <textarea
                    value={newItemNote}
                    onChange={(e) => setNewItemNote(e.target.value)}
                    placeholder="Add a note (optional)..."
                    rows={2}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
            </form>
          </div>
        )}

        {/* Items List */}
        <div className="space-y-3">
          {sortedItemsList.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No items yet</h3>
              <p className="text-gray-600">
                {permissions.canEdit 
                  ? 'Start by adding your first item above!' 
                  : 'This list is empty.'}
              </p>
            </div>
          ) : (
            sortedItemsList.map((item) => (
              <TodoItem
                key={item.id}
                item={item}
                permissions={permissions}
                onToggleComplete={handleToggleComplete}
                onDelete={handleDeleteItem}
                onVote={handleVote}
                isDraggable={listWithRole.list.sorting_mode === 'manual' && permissions.canEdit}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
              />
            ))
          )}
        </div>

        {/* Share Dialog */}
        {listWithRole && (
          <ShareDialog
            list={listWithRole}
            isOpen={showShareDialog}
            onClose={() => setShowShareDialog(false)}
          />
        )}
        
        {/* Settings Dialog */}
        {listWithRole && (
          <ListSettingsDialog
            list={listWithRole}
            isOpen={showSettingsDialog}
            onClose={() => setShowSettingsDialog(false)}
            onSettingsUpdated={handleSettingsUpdated}
          />
        )}
      </div>
    </div>
  );
}
