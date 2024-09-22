import { Controller, Post, Body, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInDto } from './dto/signin.dto';
import { SignUpDto } from './dto/signup.dto';
import { response, Response } from 'express';
import { AuthGuard } from './auth.guard';
import { ValidateRegistrationDto } from './dto/validate.dto';
import { ResetPwdDto } from './dto/reset.dto';
import { ResendOTPDto, ResetReqDto } from './dto/resetReq.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signin')
  signIn(@Body() signInDto: SignInDto, @Res() response: Response) {
    return this.authService.signin(
      signInDto.email,
      signInDto.password,
      response,
    );
  }

  @Post('signout')
  @UseGuards(AuthGuard)
  async logout(@Res() response: Response) {
    response.clearCookie('access_token', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });

    return response.json({ status: true, message: 'you are now Logged out.' });
  }

  @Post('signup')
  signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.register(
      signUpDto.phone,
      signUpDto.email,
      signUpDto.password,
      signUpDto.confirm,
      signUpDto.name,
    );
  }

  @Post('verify-signup')
  validateRegistration(
    @Body() validateRegistrationDto: ValidateRegistrationDto,
    @Res() response: Response,
  ) {
    return this.authService.validate(
      validateRegistrationDto.phone,
      validateRegistrationDto.otp,
      response,
    );
  }

  @Post('reset-pwd')
  resetPwd(@Body() resetPwdDto: ResetPwdDto) {
    return this.authService.resetPwd(
      resetPwdDto.phone,
      resetPwdDto.otp,
      resetPwdDto.password,
      resetPwdDto.confirm,
    );
  }

  @Post('resend-otp')
  resendOTP(@Body() resendOTPDto: ResendOTPDto) {
    return this.authService.resendOTP(resendOTPDto.phone, resendOTPDto.type);
  }

  @Post('req-pwd-reset')
  reqPwdReset(@Body() reqPwdResetDto: ResetReqDto) {
    return this.authService.reqPwdReset(reqPwdResetDto.phone);
  }
}
