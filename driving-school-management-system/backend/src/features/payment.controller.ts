import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'node:fs';
import { AuthGuard } from '../auth/auth.guard';
import { RequestWithUser } from '../auth/auth.types';
import { AdminPaymentFilterDto, CreatePaymentDto, RejectPaymentDto } from './dto/payment.dto';
import { PaymentService, PaymentUpload } from './payment.service';

const proofUpload = FileInterceptor('proof', {
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new BadRequestException('Proof must be a PDF, JPEG, PNG, or WebP file'), false);
      return;
    }
    callback(null, true);
  },
});

@UseGuards(AuthGuard)
@Controller()
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Post('payments')
  @UseInterceptors(proofUpload)
  create(@Req() req: RequestWithUser, @Body() dto: CreatePaymentDto, @UploadedFile() proof?: PaymentUpload) {
    return this.payments.create(req.user, dto, proof);
  }

  @Get('payments/me') mine(@Req() req: RequestWithUser) { return this.payments.mine(req.user); }

  @Get('payments/proof/:filename')
  async proof(@Req() req: RequestWithUser, @Param('filename') filename: string, @Res() response: import('express').Response) {
    const file = await this.payments.proof(req.user, filename);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', 'inline; filename="payment-proof"');
    createReadStream(file.path).on('error', () => response.status(404).end()).pipe(response);
  }

  @Get('admin/payments') list(@Req() req: RequestWithUser, @Query() filters: AdminPaymentFilterDto) {
    return this.payments.list(req.user, filters);
  }

  @Get('admin/payments/:id') detail(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.payments.detail(req.user, id);
  }

  @Patch('admin/payments/:id/approve') approve(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.payments.approve(req.user, id);
  }

  @Patch('admin/payments/:id/reject') reject(@Req() req: RequestWithUser, @Param('id') id: string, @Body() dto: RejectPaymentDto) {
    return this.payments.reject(req.user, id, dto.note);
  }
}
