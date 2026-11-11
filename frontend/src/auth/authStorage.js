export const getAuthToken = () => localStorage.getItem('supergold_auth_token') || sessionStorage.getItem('supergold_auth_token') || '';
export const getAuthStorage = () => localStorage.getItem('supergold_auth_token') ? localStorage : sessionStorage;
export const setLastActivity = (value = Date.now()) => { try { getAuthStorage().setItem('supergold_last_activity', String(value)); } catch {} };
export const clearAuthStorage = () => { localStorage.removeItem('supergold_auth_token'); localStorage.removeItem('supergold_auth_user'); localStorage.removeItem('supergold_last_activity'); sessionStorage.removeItem('supergold_auth_token'); sessionStorage.removeItem('supergold_auth_user'); sessionStorage.removeItem('supergold_last_activity'); };
