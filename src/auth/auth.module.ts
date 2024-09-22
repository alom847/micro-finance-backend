import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersService } from '../users/users.service';
import { JwtModule } from '@nestjs/jwt';
import { UserRegisteredListener } from './listeners/user-registered.listener';
import { LoansService } from 'src/loans/loans.service';
import { LoansModule } from 'src/loans/loans.module';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UsersService, UserRegisteredListener],
})
export class AuthModule {}
