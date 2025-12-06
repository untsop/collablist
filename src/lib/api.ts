export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    try {
      const errorData = await response.json();
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
    } catch {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }
  
  return response;
}

// Helper to get collaboration token from localStorage
export function getCollabToken(): string | null {
  return localStorage.getItem('collabToken');
}

// Helper to set collaboration token
export function setCollabToken(token: string): void {
  localStorage.setItem('collabToken', token);
}

// Helper to get anonymous ID
export function getAnonymousId(): string {
  let id = localStorage.getItem('anonymousId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('anonymousId', id);
  }
  return id;
}

// Helper to make authenticated API calls
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  
  // Add collaboration token if available
  const collabToken = getCollabToken();
  if (collabToken) {
    headers.set('x-collab-token', collabToken);
  }
  
  // Add anonymous ID for voting
  const anonymousId = getAnonymousId();
  headers.set('x-anonymous-id', anonymousId);
  
  return apiFetch(url, {
    ...options,
    headers
  });
}
