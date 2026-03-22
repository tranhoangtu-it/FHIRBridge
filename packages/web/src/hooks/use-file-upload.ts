/**
 * File upload hook — uploads via XHR to track real progress percentage.
 */

import { useState, useCallback } from 'react';
import { API_BASE_URL } from '../lib/constants';
import { getAuthToken } from '../api/api-client';

export interface UploadState {
  uploading: boolean;
  progress: number; // 0-100
  error: string | null;
}

export interface UseFileUploadReturn extends UploadState {
  upload: <T>(path: string, file: File, metadata?: Record<string, string>) => Promise<T | null>;
  reset: () => void;
}

export function useFileUpload(): UseFileUploadReturn {
  const [state, setState] = useState<UploadState>({
    uploading: false,
    progress: 0,
    error: null,
  });

  const upload = useCallback(
    <T>(path: string, file: File, metadata?: Record<string, string>): Promise<T | null> => {
      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        const form = new FormData();
        form.append('file', file);
        if (metadata) {
          Object.entries(metadata).forEach(([k, v]) => form.append(k, v));
        }

        setState({ uploading: true, progress: 0, error: null });

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setState((prev) => ({ ...prev, progress: Math.round((e.loaded / e.total) * 100) }));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setState({ uploading: false, progress: 100, error: null });
            try {
              resolve(JSON.parse(xhr.responseText) as T);
            } catch {
              resolve(null);
            }
          } else {
            setState({ uploading: false, progress: 0, error: `Upload failed: ${xhr.statusText}` });
            resolve(null);
          }
        });

        xhr.addEventListener('error', () => {
          setState({ uploading: false, progress: 0, error: 'Network error during upload' });
          resolve(null);
        });

        xhr.open('POST', `${API_BASE_URL}${path}`);
        const token = getAuthToken();
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(form);
      });
    },
    [],
  );

  const reset = useCallback(() => {
    setState({ uploading: false, progress: 0, error: null });
  }, []);

  return { ...state, upload, reset };
}
