export const getAuthToken = () => localStorage.getItem('supergold_auth_token') || sessionStorage.getItem('supergold_auth_token') || '';
export const apiFetch = async (url, options = {}) => {
  const headers = { ...(options.headers || {}) };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return window.fetch(url, { ...options, headers });
};
