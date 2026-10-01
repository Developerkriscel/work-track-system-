import { httpClient } from '@/lib/api/httpClient';

export function analyzeCandidate(payload) {
  return httpClient('/api/candidate-ai/analyze', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
