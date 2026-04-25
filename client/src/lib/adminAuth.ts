// In-memory admin auth state (survives page navigation within SPA)
let _isAuthenticated = false;

export function setAdminAuth(value: boolean) {
  _isAuthenticated = value;
}

export function getAdminAuth(): boolean {
  return _isAuthenticated;
}
