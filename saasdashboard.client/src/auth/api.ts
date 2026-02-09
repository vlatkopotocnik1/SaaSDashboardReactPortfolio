import { apiRequest } from '../api/client';
import { clearSession, setSession } from './session';

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    username: string;
    role: 'Admin' | 'User';
  };
};

export const login = async (username: string, password: string) => {
  const data = await apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { username, password },
    retry: 0,
  });
  setSession(data);
  return data.user;
};

export const logout = async (refreshToken: string | null) => {
  try {
    if (refreshToken) {
      await apiRequest('/api/auth/logout', {
        method: 'POST',
        body: { refreshToken },
        retry: 0,
      });
    }
  } finally {
    clearSession();
  }
};
