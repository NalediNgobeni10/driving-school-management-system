import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AdminUserDto, CarDto, CompleteBookingDto, CreateBookingDto, CreateSlotDto, MessageDto, UpdateCarDto } from './dto/feature.dto';

type Actor = { id: string; name: string; role: 'student' | 'instructor' | 'admin'; email?: string };
const day = (date: string) => { const parsed = new Date(`${date}T00:00:00.000Z`); if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid date'); return parsed; };
const passwordHash = (password: string) => { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; };

@Injectable()
export class FeaturesService {
  constructor(private readonly prisma: PrismaService) {}

  private requireRole(user: Actor, ...roles: Actor['role'][]) { if (!roles.includes(user.role)) throw new ForbiddenException('This action is not available for your role'); }
  private async booking(id: string) { const booking = await this.prisma.booking.findUnique({ where: { id } }); if (!booking) throw new NotFoundException('Booking not found'); return booking; }

  async dashboard(user: Actor) {
    if (user.role === 'student') {
      const [lessons, next, recent, current] = await Promise.all([
        this.prisma.booking.findMany({ where: { studentId: user.id, status: 'completed' } }),
        this.prisma.booking.findFirst({ where: { studentId: user.id, status: 'confirmed', date: { gte: new Date(new Date().toISOString().slice(0, 10)) } }, include: { instructor: { select: { name: true } }, car: true }, orderBy: [{ date: 'asc' }, { time: 'asc' }] }),
        this.prisma.booking.findMany({ where: { studentId: user.id }, include: { instructor: { select: { name: true } }, car: true }, orderBy: [{ date: 'desc' }, { time: 'desc' }], take: 5 }),
        this.prisma.user.findUnique({ where: { id: user.id }, select: { quizBest: true } }),
      ]);
      const upcoming = await this.prisma.booking.count({ where: { studentId: user.id, status: 'confirmed', date: { gte: new Date(new Date().toISOString().slice(0, 10)) } } });
      return { completed: lessons.length, required: 20, upcoming, hoursDriven: lessons.length, quizBest: current?.quizBest, nextLesson: next, recentLessons: recent };
    }
    if (user.role === 'instructor') return { today: await this.bookings(user, 'today'), upcomingBookings: await this.bookings(user, 'upcoming'), completed: await this.bookings(user, 'completed') };
    const now = new Date(); const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const [students, instructors, bookings, revenue] = await Promise.all([
      this.prisma.user.count({ where: { role: 'student' } }), this.prisma.user.count({ where: { role: 'instructor' } }),
      this.prisma.booking.count({ where: { date: { gte: start, lt: end } } }),
      this.prisma.payment.aggregate({ where: { status: 'APPROVED', createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    ]);
    return { students, instructors, bookingsThisMonth: bookings, revenueThisMonth: Number(revenue._sum.amount ?? 0) };
  }

  async bookings(user: Actor, filter?: string) {
    const where: any = user.role === 'admin' ? {} : user.role === 'student' ? { studentId: user.id } : { instructorId: user.id };
    if (filter === 'completed') where.status = 'completed';
    else if (filter === 'today') { where.status = 'confirmed'; where.date = day(new Date().toISOString().slice(0, 10)); }
    else if (filter === 'upcoming') { where.status = 'confirmed'; where.date = { gte: day(new Date().toISOString().slice(0, 10)) }; }
    return this.prisma.booking.findMany({ where, include: { student: { select: { id: true, name: true, email: true, phone: true } }, instructor: { select: { id: true, name: true } }, car: true }, orderBy: [{ date: 'desc' }, { time: 'asc' }] });
  }

  async createBooking(user: Actor, dto: CreateBookingDto) {
    this.requireRole(user, 'student'); const date = day(dto.date);
    if (date < day(new Date().toISOString().slice(0, 10))) throw new BadRequestException('Lessons must be booked for today or a future date');
    const slot = await this.prisma.instructorSlot.findUnique({ where: { instructorId_date_time: { instructorId: dto.instructorId, date, time: dto.time } } });
    if (!slot || slot.isBooked) throw new BadRequestException('That instructor has not made this time available');
    return this.prisma.$transaction(async (tx) => {
      if (dto.carId) {
        const car = await tx.car.findUnique({ where: { id: dto.carId } });
        if (!car || car.status !== 'available') throw new BadRequestException('That car is unavailable');
        const conflict = await tx.booking.findFirst({ where: { carId: dto.carId, date, time: dto.time, status: 'confirmed' } });
        if (conflict) throw new BadRequestException('That car has already been booked for this time');
      }
      const reserved = await tx.instructorSlot.updateMany({ where: { id: slot.id, isBooked: false }, data: { isBooked: true } });
      if (!reserved.count) throw new BadRequestException('That time was just booked');
      const booking = await tx.booking.create({ data: { studentId: user.id, instructorId: dto.instructorId, carId: dto.carId, date, time: dto.time } });
      return booking;
    }, { isolationLevel: 'Serializable' });
  }

  async cancelBooking(user: Actor, id: string) {
    const booking = await this.booking(id); if (user.role !== 'admin' && !(user.role === 'student' && booking.studentId === user.id)) throw new ForbiddenException();
    if (booking.status !== 'confirmed') throw new BadRequestException('Only confirmed lessons can be cancelled');
    const result = await this.prisma.booking.update({ where: { id }, data: { status: 'cancelled' } });
    await this.prisma.instructorSlot.updateMany({ where: { instructorId: booking.instructorId, date: booking.date, time: booking.time }, data: { isBooked: false } });
    return result;
  }

  async completeBooking(user: Actor, id: string, dto: CompleteBookingDto) {
    this.requireRole(user, 'instructor'); const booking = await this.booking(id); if (booking.instructorId !== user.id) throw new ForbiddenException();
    if (booking.status !== 'confirmed') throw new BadRequestException('This lesson is no longer active');
    return this.prisma.booking.update({ where: { id }, data: { status: 'completed', rating: dto.rating, feedback: dto.feedback } });
  }

  async noShow(user: Actor, id: string) {
    this.requireRole(user, 'instructor'); const booking = await this.booking(id); if (booking.instructorId !== user.id) throw new ForbiddenException();
    const result = await this.prisma.booking.update({ where: { id }, data: { status: 'cancelled' } });
    await this.prisma.instructorSlot.updateMany({ where: { instructorId: booking.instructorId, date: booking.date, time: booking.time }, data: { isBooked: false } });
    return result;
  }

  async instructors() { return this.prisma.user.findMany({ where: { role: 'instructor' }, select: { id: true, name: true } }); }
  async availableSlots(instructorId: string, date: string) { return this.prisma.instructorSlot.findMany({ where: { instructorId, date: day(date), isBooked: false }, select: { id: true, time: true }, orderBy: { time: 'asc' } }); }
  async availableCars(date: string, time: string) {
    const booked = await this.prisma.booking.findMany({ where: { date: day(date), time, status: 'confirmed', carId: { not: null } }, select: { carId: true } });
    return this.prisma.car.findMany({ where: { status: 'available', id: { notIn: booked.map((item) => item.carId!).filter(Boolean) } }, orderBy: { make: 'asc' } });
  }
  async addSlot(user: Actor, dto: CreateSlotDto) { this.requireRole(user, 'instructor'); const date = day(dto.date); if (date < day(new Date().toISOString().slice(0, 10))) throw new BadRequestException('Availability must be today or a future date'); return this.prisma.instructorSlot.create({ data: { instructorId: user.id, date, time: dto.time } }); }
  async mySlots(user: Actor) { this.requireRole(user, 'instructor'); return this.prisma.instructorSlot.findMany({ where: { instructorId: user.id, date: { gte: day(new Date().toISOString().slice(0, 10)) } }, orderBy: [{ date: 'asc' }, { time: 'asc' }] }); }

  async notes() { return this.prisma.k53Note.findMany({ orderBy: { order: 'asc' } }); }
  async saveQuiz(user: Actor, score: number) {
    this.requireRole(user, 'student'); const current = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { quizBest: true } });
    if (score > (current.quizBest ?? -1)) return this.prisma.user.update({ where: { id: user.id }, data: { quizBest: score }, select: { quizBest: true } });
    return current;
  }

  private async canMessage(user: Actor, otherId: string) {
    if (user.role === 'admin') return true;
    const other = await this.prisma.user.findUnique({ where: { id: otherId }, select: { id: true, role: true } });
    if (!other) return false;
    if (other.role === 'admin') return true;
    if (user.role === 'student' && other.role === 'instructor') return !!await this.prisma.booking.findFirst({ where: { studentId: user.id, instructorId: otherId } });
    if (user.role === 'instructor' && other.role === 'student') return !!await this.prisma.booking.findFirst({ where: { studentId: otherId, instructorId: user.id } });
    return false;
  }
  async contacts(user: Actor) {
    if (user.role === 'admin') return this.prisma.user.findMany({ where: { id: { not: user.id } }, select: { id: true, name: true, role: true, email: true }, orderBy: { name: 'asc' } });
    const bookings = await this.prisma.booking.findMany({ where: user.role === 'student' ? { studentId: user.id } : { instructorId: user.id }, select: user.role === 'student' ? { instructor: { select: { id: true, name: true, role: true } } } : { student: { select: { id: true, name: true, role: true } } } });
    const ids = [...new Set(bookings.map((b: any) => user.role === 'student' ? b.instructor.id : b.student.id))];
    return this.prisma.user.findMany({ where: { OR: [{ id: { in: ids } }, { role: 'admin' }] }, select: { id: true, name: true, role: true }, orderBy: { name: 'asc' } });
  }
  async thread(user: Actor, otherId: string) {
    if (!(await this.canMessage(user, otherId))) throw new ForbiddenException('You cannot message this user');
    await this.prisma.message.updateMany({ where: { fromUserId: otherId, toUserId: user.id, read: false }, data: { read: true } });
    return this.prisma.message.findMany({ where: { OR: [{ fromUserId: user.id, toUserId: otherId }, { fromUserId: otherId, toUserId: user.id }] }, include: { fromUser: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } });
  }
  async sendMessage(user: Actor, dto: MessageDto) {
    if (!(await this.canMessage(user, dto.toUserId))) throw new ForbiddenException('You cannot message this user');
    return this.prisma.message.create({ data: { fromUserId: user.id, toUserId: dto.toUserId, text: dto.text.trim() } });
  }

  async people(user: Actor) { this.requireRole(user, 'admin'); return this.prisma.user.findMany({ where: { role: { in: ['student', 'instructor'] } }, select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true }, orderBy: { name: 'asc' } }); }
  async addPerson(user: Actor, dto: AdminUserDto) {
    this.requireRole(user, 'admin'); return this.prisma.user.create({ data: { name: dto.name, email: dto.email.toLowerCase(), phone: dto.phone, role: dto.role, passwordHash: passwordHash(dto.password) }, select: { id: true, name: true, email: true, phone: true, role: true } });
  }
  async cars(user: Actor) { this.requireRole(user, 'admin'); return this.prisma.car.findMany({ orderBy: { make: 'asc' } }); }
  async addCar(user: Actor, dto: CarDto) { this.requireRole(user, 'admin'); return this.prisma.car.create({ data: dto }); }
  async editCar(user: Actor, id: string, dto: UpdateCarDto) { this.requireRole(user, 'admin'); return this.prisma.car.update({ where: { id }, data: dto }); }
  async deleteCar(user: Actor, id: string) { this.requireRole(user, 'admin'); return this.prisma.car.delete({ where: { id } }); }
  async setCarStatus(user: Actor, id: string, status: 'available' | 'unavailable') { this.requireRole(user, 'admin'); return this.prisma.car.update({ where: { id }, data: { status } }); }
}
