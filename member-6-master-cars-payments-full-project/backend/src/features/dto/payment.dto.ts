import { Transform, Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePaymentDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(99999999.99) amount!: number;
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @Matches(/^[\s\S]{1,100}$/, { message: 'bookingId is required and must be a nonempty string of at most 100 characters' }) bookingId!: string;
  @IsOptional() @IsString() @MaxLength(100) packageId?: string;
  @IsString() @MinLength(2) @MaxLength(100) purpose!: string;
  @IsIn(['EFT', 'CARD', 'CASH']) method!: 'EFT' | 'CARD' | 'CASH';
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(2) @MaxLength(100) reference!: string;
}

export class AdminPaymentFilterDto {
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED']) status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(100) student?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class RejectPaymentDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(3) @MaxLength(500) note!: string;
}
