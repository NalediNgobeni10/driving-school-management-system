import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { FeaturesModule } from './features/features.module';

@Module({
  imports: [PrismaModule, AuthModule, FeaturesModule],
})
export class AppModule {}
