import { Item } from '../types';

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
  const handleToggleComplete = () => {
    if (permissions.canEdit) {
      onToggleComplete(item.id, !item.is_completed);
    }
  };

  const handleDelete = () => {
    if (permissions.canDelete && window.confirm('Are you sure you want to delete this item?')) {
      onDelete(item.id);
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
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
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
            <h3 className={`text-gray-900 font-medium ${item.is_completed ? 'line-through text-gray-500' : ''}`}>
              {item.text}
            </h3>
            {item.note && (
              <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">{item.note}</p>
            )}
          </div>
          
          {/* Vote section */}
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
          </div>
        </div>

        {/* Actions - Compact and touch-friendly */}
        <div className="mt-2 flex items-center gap-2">
          {permissions.canEdit && (
            <button
              onClick={handleToggleComplete}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50"
            >
              {item.is_completed ? 'Undo' : 'Complete'}
            </button>
          )}
          
          {permissions.canDelete && (
            <button
              onClick={handleDelete}
              className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
