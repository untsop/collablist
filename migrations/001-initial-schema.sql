-- Initial schema for CollabList
-- Users table
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Lists table
CREATE TABLE lists (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    view_token TEXT UNIQUE NOT NULL,
    edit_token TEXT UNIQUE NOT NULL,
    sorting_mode TEXT DEFAULT 'updated',
    voting_policy TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Items table
CREATE TABLE items (
    id TEXT PRIMARY KEY,
    list_id TEXT NOT NULL,
    text TEXT NOT NULL,
    note TEXT,
    position REAL NOT NULL DEFAULT 0,
    is_completed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
);

-- Votes table
CREATE TABLE votes (
    item_id TEXT NOT NULL,
    voter_id TEXT,
    anonymous_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    UNIQUE(item_id, voter_id),
    UNIQUE(item_id, anonymous_hash),
    CHECK ((voter_id IS NOT NULL AND anonymous_hash IS NULL) OR (voter_id IS NULL AND anonymous_hash IS NOT NULL))
);

-- Collaborators table
CREATE TABLE collaborators (
    list_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (list_id, user_id),
    FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
