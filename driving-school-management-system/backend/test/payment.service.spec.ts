import { equal, match, rejects, throws } from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PaymentService } from '../src/features/payment.service';

const student = { id: 'student-1', role: 'student' as const };
const admin = { id: 'admin-1', role: 'admin' as const };
const pendingPayment = { id: 'payment-1', studentId: student.id, bookingId: 'booking-1', status: 'PENDING', reference: 'EFT-123', purpose: 'Lesson booking', student: { name: 'Test Student' } };

function txMock(overrides: Record<string, any> = {}) {
  const tx = {
    payment: {
      findUnique: async () => pendingPayment,
      updateMany: async () => ({ count: 1 }),
      findUniqueOrThrow: async () => ({ ...pendingPayment, status: 'APPROVED' }),
      ...overrides.payment,
    },
    booking: { update: async () => ({ id: pendingPayment.bookingId, paid: true }), ...overrides.booking },
    message: { create: async ({ data }: any) => data, ...overrides.message },
  };
  const prisma: any = {
    $transaction: async (run: (tx: any) => unknown) => run(tx),
    booking: { findFirst: async () => ({ id: pendingPayment.bookingId, status: 'confirmed', paid: false }) },
    payment: { findFirst: async () => null },
    ...overrides.prisma,
  };
  return { tx, prisma, service: new PaymentService(prisma) };
}

test('creates a pending student payment', async () => {
  let createData: any;
  const { service } = txMock({
    prisma: { payment: { create: async ({ data }: any) => { createData = data; return { ...data, status: 'PENDING' }; } } },
  });
  const payment = await service.create(student, { bookingId: pendingPayment.bookingId, amount: 350, purpose: 'Lesson booking', method: 'EFT', reference: 'BANK-42' });
  equal(payment.status, 'PENDING');
  equal(createData.studentId, student.id);
  equal(createData.reference, 'BANK-42');
  equal(createData.bookingId, pendingPayment.bookingId);
  equal(createData.packageId, null);
});

test('approves once, marks the booking paid, and notifies the student in one transaction', async () => {
  let bookingUpdated = false; let notification: any;
  const { service } = txMock({
    booking: { update: async () => { bookingUpdated = true; return { id: pendingPayment.bookingId }; } },
    message: { create: async ({ data }: any) => { notification = data; return data; } },
  });
  const result = await service.approve(admin, pendingPayment.id);
  equal(result.status, 'APPROVED');
  equal(bookingUpdated, true);
  equal(notification.toUserId, student.id);
  match(notification.text, /approved/);
});

test('rejects with an admin note and sends the note to the student', async () => {
  let notification: any;
  const { service } = txMock({
    payment: { findUniqueOrThrow: async () => ({ ...pendingPayment, status: 'REJECTED', adminNote: 'Reference is unclear' }) },
    message: { create: async ({ data }: any) => { notification = data; return data; } },
  });
  const result = await service.reject(admin, pendingPayment.id, '  Reference is unclear  ');
  equal(result.status, 'REJECTED');
  match(notification.text, /Reference is unclear/);
  throws(() => service.reject(admin, pendingPayment.id, '  '), BadRequestException);
});

test('blocks non-students from creating payments and non-admins from approval', async () => {
  const { service } = txMock();
  await rejects(service.create({ id: 'instructor-1', role: 'instructor' }, { bookingId: pendingPayment.bookingId, amount: 200, purpose: 'Lesson booking', method: 'CASH', reference: 'CASH-2' }), ForbiddenException);
  throws(() => service.approve(student, pendingPayment.id), ForbiddenException);
});

test('blocks a second review after the payment is no longer pending', async () => {
  const { service } = txMock({ payment: { findUnique: async () => ({ ...pendingPayment, status: 'APPROVED' }) } });
  await rejects(service.approve(admin, pendingPayment.id), BadRequestException);
});
