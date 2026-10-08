import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FeaturesController } from './features.controller';
import { FeaturesService } from './features.service';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({ imports: [AuthModule], controllers: [FeaturesController, PaymentController], providers: [FeaturesService, PaymentService] })
export class FeaturesModule {}
