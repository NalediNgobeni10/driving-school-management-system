export type AppRole = 'student' | 'instructor' | 'admin';
export interface AuthUser { id: string; name: string; email: string; role: AppRole; phone: string | null; quizBest: number | null; }
export interface RequestWithUser extends Request { user: AuthUser; }
