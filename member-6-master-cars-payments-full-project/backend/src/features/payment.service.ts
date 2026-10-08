import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { AdminPaymentFilterDto, CreatePaymentDto } from './dto/payment.dto';

export type PaymentActor = { id: string; role: 'student' | 'instructor' | 'admin' };
export type PaymentUpload = { originalname: string; mimetype: string; buffer: Buffer };

const uploadTypes = {
  'application/pdf': { extension: 'pdf', valid: (buffer: Buffer) => buffer.subarray(0, 5).toString() === '%PDF-' },
  'image/jpeg': { extension: 'jpg', valid: (buffer: Buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  'image/png': { extension: 'png', valid: (buffer: Buffer) => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  'image/webp': { extension: 'webp', valid: (buffer: Buffer) => buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP' },
} as const;

@Injectable()
export class PaymentService {
  private readonly proofDirectory = join(process.cwd(), 'uploads', 'payment-proofs');

  constructor(private readonly prisma: PrismaService) {}

  private requireRole(user: PaymentActor, role: PaymentActor['role']) {
    if (user.role !== role) throw new ForbiddenException('This action is not available for your role');
  }

  async create(user: PaymentActor, dto: CreatePaymentDto, upload?: PaymentUpload) {
    this.requireRole(user, 'student');
    if (!dto.bookingId) throw new BadRequestException('A booking is required for a payment');
    if (dto.packageId) throw new BadRequestException('Lesson packages are not configured yet');

    const booking = await this.prisma.booking.findFirst({ where: { id: dto.bookingId, studentId: user.id } });
    if (!booking) throw new NotFoundException('That lesson booking was not found');
    if (booking.status === 'cancelled') throw new BadRequestException('A cancelled lesson cannot be paid');
    if (booking.paid) throw new BadRequestException('This lesson has already been paid');
    const pending = await this.prisma.payment.findFirst({ where: { bookingId: booking.id, submittedByStudent: true, status: 'PENDING' } });
    if (pending) throw new BadRequestException('A payment for this lesson is already awaiting review');

    let proofFileUrl: string | undefined;
    let savedPath: string | undefined;
    if (upload) {
      const type = uploadTypes[upload.mimetype as keyof typeof uploadTypes];
      if (!type || !type.valid(upload.buffer)) throw new BadRequestException('Proof must be a valid PDF, JPEG, PNG, or WebP file');
      await mkdir(this.proofDirectory, { recursive: true });
      const filename = `${randomBytes(24).toString('hex')}.${type.extension}`;
      savedPath = join(this.proofDirectory, filename);
      proofFileUrl = `/payments/proof/${filename}`;
      await writeFile(savedPath, upload.buffer, { flag: 'wx', mode: 0o600 });
    }

    try {
      return await this.prisma.payment.create({
        data: {
          studentId: user.id,
          bookingId: dto.bookingId,
          packageId: null,
          purpose: dto.purpose.trim(),
          amount: new Prisma.Decimal(dto.amount),
          currency: 'ZAR',
          method: dto.method,
          reference: dto.reference.trim(),
          proofFileUrl,
        },
        include: { booking: { select: { id: true, date: true, time: true } } },
      });
    } catch (error) {
      if (savedPath) await unlink(savedPath).catch(() => undefined);
      throw error;
    }
  }

  async mine(user: PaymentActor) {
    this.requireRole(user, 'student');
    return this.prisma.payment.findMany({
      where: { studentId: user.id, submittedByStudent: true },
      include: { booking: { select: { id: true, date: true, time: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async list(user: PaymentActor, filters: AdminPaymentFilterDto) {
    this.requireRole(user, 'admin');
    const from = filters.from ? new Date(`${filters.from}T00:00:00.000Z`) : undefined;
    const to = filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : undefined;
    if (from && Number.isNaN(from.getTime())) throw new BadRequestException('Invalid start date');
    if (to && Number.isNaN(to.getTime())) throw new BadRequestException('Invalid end date');
    if (from && to && from > to) throw new BadRequestException('Start date must be before end date');

    const student = filters.student?.trim();
    const where: Prisma.PaymentWhereInput = {
      submittedByStudent: true,
      ...(filters.status ? { status: filters.status as PaymentStatus } : {}),
      ...(student ? { student: { name: { contains: student, mode: 'insensitive' } } } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    };
    const [items, pendingCount] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          student: { select: { id: true, name: true, email: true, phone: true } },
          booking: { include: { instructor: { select: { id: true, name: true } }, car: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where: { status: 'PENDING', submittedByStudent: true } }),
    ]);
    return { items, pendingCount };
  }

  async detail(user: PaymentActor, id: string) {
    this.requireRole(user, 'admin');
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, name: true, email: true, phone: true } },
        booking: { include: { instructor: { select: { id: true, name: true } }, car: true } },
        reviewer: { select: { id: true, name: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  approve(user: PaymentActor, id: string) {
    this.requireRole(user, 'admin');
    return this.review(user, id, 'APPROVED');
  }

  reject(user: PaymentActor, id: string, note: string) {
    this.requireRole(user, 'admin');
    if (!note?.trim() || note.trim().length < 3) throw new BadRequestException('A rejection note of at least 3 characters is required');
    return this.review(user, id, 'REJECTED', note.trim());
  }

  private async review(user: PaymentActor, id: string, status: 'APPROVED' | 'REJECTED', note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id }, include: { student: { select: { name: true } } } });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status !== 'PENDING') throw new BadRequestException('This payment has already been reviewed');

      const reviewedAt = new Date();
      const updated = await tx.payment.updateMany({
        where: { id, status: 'PENDING' },
        data: { status, adminNote: note ?? null, reviewedBy: user.id, reviewedAt },
      });
      if (!updated.count) throw new BadRequestException('This payment has already been reviewed');
      if (status === 'APPROVED' && payment.bookingId) {
        await tx.booking.update({ where: { id: payment.bookingId }, data: { paid: true } });
      }

      const message = status === 'APPROVED'
        ? `Your payment (${payment.reference}) for ${payment.purpose} has been approved.`
        : `Your payment (${payment.reference}) for ${payment.purpose} was rejected. Reason: ${note}`;
      await tx.message.create({ data: { fromUserId: user.id, toUserId: payment.studentId, text: message } });
      return tx.payment.findUniqueOrThrow({ where: { id }, include: { student: { select: { id: true, name: true, email: true, phone: true } }, booking: true } });
    }, { isolationLevel: 'Serializable' });
  }

  async proof(user: PaymentActor, filename: string) {
    if (!/^[a-f0-9]{48}\.(pdf|jpg|png|webp)$/.test(filename)) throw new NotFoundException('Payment proof not found');
    const proofFileUrl = `/payments/proof/${filename}`;
    const payment = await this.prisma.payment.findFirst({ where: { proofFileUrl }, select: { studentId: true } });
    if (!payment) throw new NotFoundException('Payment proof not found');
    if (user.role !== 'admin' && !(user.role === 'student' && payment.studentId === user.id)) throw new ForbiddenException('You cannot view this payment proof');
    const extension = filename.split('.').pop();
    const path = join(this.proofDirectory, filename);
    return { path, contentType: extension === 'pdf' ? 'application/pdf' : `image/${extension === 'jpg' ? 'jpeg' : extension}` };
  }
}
