import { Item } from '../types';
import { useState, useRef, useEffect } from 'react';

interface TodoItemProps {
  item: Item;
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
    canVote: boolean;
  };
  onToggleComplete: (itemId: string, completed: boolean) => void;
  onDelete: (itemId: string) => void;
  onVote: (itemId: string) => void;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent, itemId: string) => void;
  onDragOver?: (e: React.DragEvent, itemId: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, itemId: string) => void;
}

export default function TodoItem({ 
  item, 
  permissions, 
  onToggleComplete, 
  onDelete, 
  onVote,
  isDraggable = false,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop
}: TodoItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleToggleComplete = () => {
    if (permissions.canEdit) {
      onToggleComplete(item.id, !item.is_completed);
    }
  };

  const handleDelete = () => {
    if (permissions.canDelete && window.confirm('Are you sure you want to delete this item?')) {
      onDelete(item.id);
      setShowMenu(false);
    }
  };

  const handleVote = () => {
    if (permissions.canVote) {
      onVote(item.id);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (isDraggable && onDragStart) {
      onDragStart(e, item.id);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isDraggable && onDragOver) {
      onDragOver(e, item.id);
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (isDraggable && onDragEnd) {
      onDragEnd(e);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (isDraggable && onDrop) {
      onDrop(e, item.id);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div 
      className={`flex items-start gap-3 p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow transition-all ${
        isDraggable && permissions.canEdit ? 'cursor-move' : ''
      } ${item.is_completed ? 'opacity-75' : ''}`}
      draggable={isDraggable && permissions.canEdit}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDrop={handleDrop}
    >
      {/* Drag handle */}
      {isDraggable && permissions.canEdit && (
        <div className="mt-1 flex-shrink-0 cursor-move text-gray-300 hover:text-gray-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16" />
          </svg>
        </div>
      )}
      
      {/* Checkbox for completion */}
      {permissions.canEdit && (
        <button
          onClick={handleToggleComplete}
          className="mt-0.5 flex-shrink-0"
          aria-label={item.is_completed ? 'Mark as incomplete' : 'Mark as complete'}
        >
          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
            item.is_completed 
              ? 'bg-green-500 border-green-500' 
              : 'border-gray-300 hover:border-gray-400'
          }`}>
            {item.is_completed && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </button>
      )}

      {/* Item content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className={`text-gray-900 font-medium ${item.is_completed ? 'line-through text-gray-500' : ''}`}>
                {item.text}
              </h3>
            </div>
            {item.note && (
              <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">{item.note}</p>
            )}
          </div>
          
          {/* Vote section and menu */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleVote}
              disabled={!permissions.canVote}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium transition-colors ${
                item.has_voted
                  ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              } ${!permissions.canVote ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-label={item.has_voted ? 'Remove vote' : 'Vote for this item'}
            >
              <svg 
                className={`w-4 h-4 ${item.has_voted ? 'text-blue-500' : 'text-gray-400'}`} 
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
              </svg>
              <span className="font-semibold">{item.vote_count || 0}</span>
            </button>
            
            {/* 3-dots menu for actions */}
            {(permissions.canEdit || permissions.canDelete) && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                  aria-label="More options"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
                
                {showMenu && (
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                    {permissions.canEdit && (
                      <button
                        onClick={handleToggleComplete}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {item.is_completed ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          )}
                        </svg>
                        {item.is_completed ? 'Mark as incomplete' : 'Mark as complete'}
                      </button>
                    )}
                    
                    {permissions.canDelete && (
                      <button
                        onClick={handleDelete}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
