export interface User {
  id: string;
  name: string | null;
  created_at: string;
}

export interface List {
  id: string;
  title: string;
  owner_id: string;
  view_token: string;
  edit_token?: string; // Optional, only shown to authorized users
  sorting_mode: 'updated' | 'created' | 'manual' | 'vote';
  voting_policy: 'open' | 'restricted';
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  list_id: string;
  text: string;
  note: string | null;
  position: number;
  is_completed: number;
  created_at: string;
  updated_at: string;
  vote_count?: number;
  has_voted?: boolean;
}

export interface ItemsResponse {
  items: Item[];
}

export interface Vote {
  item_id: string;
  voter_id: string | null;
  anonymous_hash: string | null;
  created_at: string;
}

export interface Collaborator {
  list_id: string;
  user_id: string;
}

export interface ListWithRole {
  list: List;
  role: 'owner' | 'collaborator' | 'editor' | 'viewer';
}
