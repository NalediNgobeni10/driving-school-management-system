import axios from 'axios';

export type Role = 'student' | 'instructor' | 'admin';
export interface User { id: string; name: string; email: string; role: Role; phone: string | null; quizBest: number | null; }
export interface Booking { id: string; date: string; time: string; status: 'confirmed' | 'completed' | 'cancelled'; paid: boolean; rating: number | null; feedback: string | null; student?: Pick<User, 'id' | 'name' | 'email' | 'phone'>; instructor?: Pick<User, 'id' | 'name'>; car?: Car | null; }
export interface Car { id: string; make: string; model: string; plate: string; status: 'available' | 'unavailable'; }
export interface Payment { id: string; amount: string | number; currency: string; method: string; reference: string; purpose: string; bookingId: string; packageId: string | null; proofFileUrl: string | null; status: 'PENDING' | 'APPROVED' | 'REJECTED'; adminNote: string | null; reviewedAt: string | null; createdAt: string; student?: Pick<User, 'id' | 'name' | 'email' | 'phone'>; booking?: Booking; }
export interface Note { id: string; title: string; body: string; order: number; }
export interface Message { id: string; fromUserId: string; toUserId: string; text: string; createdAt: string; read: boolean; fromUser: { id: string; name: string }; }
export interface Contact { id: string; name: string; email?: string; role: Role; }
export interface Dashboard { completed: number; required: number; upcoming: number; hoursDriven: number; quizBest: number | null; nextLesson: Booking | null; recentLessons: Booking[]; students?: number; instructors?: number; bookingsThisMonth?: number; revenueThisMonth?: number; today?: Booking[]; upcomingBookings?: Booking[]; }

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api', headers: { 'Content-Type': 'application/json' } });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('driveright.token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use((response) => response, (error: unknown) => {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401 && !String(error.config?.url).includes('/auth/')) {
      localStorage.removeItem('driveright.token');
      localStorage.removeItem('driveright.user');
      localStorage.removeItem('driveright.role');
      if (window.location.pathname.startsWith('/app')) window.location.assign('/login');
    }
    if (error.response) {
      const message = error.response.data?.message;
      const detail = typeof message === 'string' ? message : Array.isArray(message) ? message.join(', ') : error.response.statusText;
      error.message = `${detail || 'Request failed'} (HTTP ${error.response.status})`;
    } else if (error.request) {
      error.message = `Could not connect to the DriveRight API at ${api.defaults.baseURL}. Check that the backend is running.`;
    }
  }
  return Promise.reject(error);
});

export const apiGet = async <T>(path: string) => (await api.get<T>(path)).data;
export const apiPost = async <T>(path: string, body?: unknown) => (await api.post<T>(path, body, body instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined)).data;
export const apiPatch = async <T>(path: string, body?: unknown) => (await api.patch<T>(path, body)).data;
export const apiDelete = async <T>(path: string) => (await api.delete<T>(path)).data;
export const apiGetBlob = async (path: string) => (await api.get<Blob>(path, { responseType: 'blob' })).data;
