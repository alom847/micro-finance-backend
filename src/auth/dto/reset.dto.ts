import { IsNotEmpty, MinLength } from 'class-validator';

export class ResetPwdDto {
  @IsNotEmpty()
  phone: string;

  @IsNotEmpty()
  otp: string;

  @IsNotEmpty()
  @MinLength(6, { message: 'password must be atleast 6 charcter.' })
  password: string;

  @IsNotEmpty()
  @MinLength(6, { message: 'password must be atleast 6 charcter.' })
  confirm: string;
}
