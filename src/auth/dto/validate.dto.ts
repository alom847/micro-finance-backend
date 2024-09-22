import { IsNotEmpty, IsPhoneNumber, IsString } from 'class-validator';

export class ValidateRegistrationDto {
  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsString()
  otp: string;
}
