import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PharmacyEventsGateway } from './pharmacy-events.gateway';

@Module({
  imports: [AuthModule],
  providers: [PharmacyEventsGateway],
  exports: [PharmacyEventsGateway],
})
export class RealtimeModule {}
