import { IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, MinLength } from 'class-validator';

export class CreateBookingDto { @IsString() instructorId!: string; @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string; @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) time!: string; @IsOptional() @IsString() carId?: string; }
export class CreateSlotDto { @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string; @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) time!: string; }
export class CompleteBookingDto { @IsInt() @Min(1) @Max(5) rating!: number; @IsString() @MinLength(2) feedback!: string; }
export class QuizDto { @IsInt() @Min(0) @Max(8) score!: number; }
export class MessageDto { @IsString() toUserId!: string; @IsString() @MinLength(1) text!: string; }
export class AdminUserDto { @IsString() @MinLength(2) name!: string; @IsEmail() email!: string; @IsString() phone!: string; @IsString() @MinLength(8) password!: string; @IsIn(['student', 'instructor']) role!: 'student' | 'instructor'; }
export class CarDto { @IsString() make!: string; @IsString() model!: string; @IsString() plate!: string; @IsOptional() @IsIn(['available', 'unavailable']) status?: 'available' | 'unavailable'; }
export class UpdateCarDto { @IsOptional() @IsString() make?: string; @IsOptional() @IsString() model?: string; @IsOptional() @IsString() plate?: string; @IsOptional() @IsIn(['available', 'unavailable']) status?: 'available' | 'unavailable'; }
export class StatusDto { @IsIn(['available', 'unavailable']) status!: 'available' | 'unavailable'; }
