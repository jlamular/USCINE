import { apiGet } from './api';

export function getHealth() {
  return apiGet('/api/health');
}