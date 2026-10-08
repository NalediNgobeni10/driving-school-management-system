import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RequestWithUser } from '../auth/auth.types';
import { AdminUserDto, CarDto, CompleteBookingDto, CreateBookingDto, CreateSlotDto, MessageDto, QuizDto, StatusDto, UpdateCarDto } from './dto/feature.dto';
import { FeaturesService } from './features.service';

@UseGuards(AuthGuard)
@Controller()
export class FeaturesController {
  constructor(private readonly features: FeaturesService) {}
  @Get('dashboard') dashboard(@Req() req: RequestWithUser) { return this.features.dashboard(req.user); }
  @Get('bookings') bookings(@Req() req: RequestWithUser, @Query('filter') filter?: string) { return this.features.bookings(req.user, filter); }
  @Post('bookings') createBooking(@Req() req: RequestWithUser, @Body() dto: CreateBookingDto) { return this.features.createBooking(req.user, dto); }
  @Patch('bookings/:id/cancel') cancel(@Req() req: RequestWithUser, @Param('id') id: string) { return this.features.cancelBooking(req.user, id); }
  @Patch('bookings/:id/complete') complete(@Req() req: RequestWithUser, @Param('id') id: string, @Body() dto: CompleteBookingDto) { return this.features.completeBooking(req.user, id, dto); }
  @Patch('bookings/:id/no-show') noShow(@Req() req: RequestWithUser, @Param('id') id: string) { return this.features.noShow(req.user, id); }
  @Get('instructors') instructors() { return this.features.instructors(); }
  @Get('slots') slots(@Query('instructorId') instructorId: string, @Query('date') date: string) { return this.features.availableSlots(instructorId, date); }
  @Post('slots') addSlot(@Req() req: RequestWithUser, @Body() dto: CreateSlotDto) { return this.features.addSlot(req.user, dto); }
  @Get('slots/mine') mySlots(@Req() req: RequestWithUser) { return this.features.mySlots(req.user); }
  @Get('cars/available') availableCars(@Query('date') date: string, @Query('time') time: string) { return this.features.availableCars(date, time); }
  @Get('k53/notes') notes() { return this.features.notes(); }
  @Post('k53/quiz-score') quiz(@Req() req: RequestWithUser, @Body() dto: QuizDto) { return this.features.saveQuiz(req.user, dto.score); }
  @Get('messages/contacts') contacts(@Req() req: RequestWithUser) { return this.features.contacts(req.user); }
  @Get('messages/:userId') thread(@Req() req: RequestWithUser, @Param('userId') userId: string) { return this.features.thread(req.user, userId); }
  @Post('messages') send(@Req() req: RequestWithUser, @Body() dto: MessageDto) { return this.features.sendMessage(req.user, dto); }
  @Get('admin/people') people(@Req() req: RequestWithUser) { return this.features.people(req.user); }
  @Post('admin/people') addPerson(@Req() req: RequestWithUser, @Body() dto: AdminUserDto) { return this.features.addPerson(req.user, dto); }
  @Get('admin/cars') cars(@Req() req: RequestWithUser) { return this.features.cars(req.user); }
  @Post('admin/cars') addCar(@Req() req: RequestWithUser, @Body() dto: CarDto) { return this.features.addCar(req.user, dto); }
  @Patch('admin/cars/:id') editCar(@Req() req: RequestWithUser, @Param('id') id: string, @Body() dto: UpdateCarDto) { return this.features.editCar(req.user, id, dto); }
  @Patch('admin/cars/:id/status') carStatus(@Req() req: RequestWithUser, @Param('id') id: string, @Body() dto: StatusDto) { return this.features.setCarStatus(req.user, id, dto.status); }
  @Delete('admin/cars/:id') deleteCar(@Req() req: RequestWithUser, @Param('id') id: string) { return this.features.deleteCar(req.user, id); }
}
