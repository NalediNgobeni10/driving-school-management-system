import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

@Injectable()
export class AuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
        const secret = process.env.JWT_SECRET;
        if (!token || !secret) throw new UnauthorizedException('Sign in to continue');
        const [head, body, signature] = token.split('.');
        if (!head || !body || !signature) throw new UnauthorizedException('Invalid session');
        const data = `${head}.${body}`;
        const expected = createHmac('sha256', secret).update(data).digest();
        let received: Buffer;
        try { received = Buffer.from(signature, 'base64url'); } catch { throw new UnauthorizedException('Invalid session'); }
        if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new UnauthorizedException('Invalid session');
        try {
            const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
            if (!payload.sub || payload.exp < Date.now() / 1000 || !['student', 'instructor', 'admin'].includes(payload.role)) throw new Error();
            request.user = { id: payload.sub, name: payload.name, email: payload.email, role: payload.role, phone: null, quizBest: null };
            return true;
        } catch { throw new UnauthorizedException('Session expired or invalid'); }
    }
}
