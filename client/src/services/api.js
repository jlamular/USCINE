const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function apiGet(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    const error = new Error(`Server responded with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}