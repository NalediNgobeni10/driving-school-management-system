import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const publicUser = (u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, quizBest: u.quizBest });

@Injectable()
export class AuthService {
    constructor(private readonly prisma: PrismaService) {}

    private hash(password: string): string {
        const salt = randomBytes(16).toString('hex');
        return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
    }

    private verify(password: string, stored: string): boolean {
        const [salt, hash] = stored.split(':');
        if (!salt || !hash) return false;
        const expected = Buffer.from(hash, 'hex');
        const actual = scryptSync(password, salt, 64);
        return expected.length === actual.length && timingSafeEqual(expected, actual);
    }

    private token(user: any): string {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET must be configured');
        const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
        const head = encode({ alg: 'HS256', typ: 'JWT' });
        const body = encode({ sub: user.id, name: user.name, email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) + 43200 });
        const data = `${head}.${body}`;
        return `${data}.${createHmac('sha256', secret).update(data).digest('base64url')}`;
    }

    async register(dto: RegisterDto) {
        if (await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } })) throw new ConflictException('An account with that email already exists');
        const user = await this.prisma.user.create({ data: { name: dto.name, email: dto.email.toLowerCase(), phone: dto.phone, passwordHash: this.hash(dto.password), role: 'student' } });
        return { accessToken: this.token(user), user: publicUser(user) };
    }

    async login(dto: LoginDto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
        if (!user || !this.verify(dto.password, user.passwordHash)) throw new UnauthorizedException('Email or password is incorrect');
        if (user.role !== dto.role) {
            const article = dto.role === 'student' ? 'a' : 'an';
            throw new UnauthorizedException(`This account is not registered as ${article} ${dto.role}`);
        }
        return { accessToken: this.token(user), user: publicUser(user) };
    }
}
