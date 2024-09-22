import { IsNotEmpty, IsPhoneNumber, IsString } from 'class-validator';

export class SignInDto {
  @IsNotEmpty()
  @IsString()
  email: string;

  @IsNotEmpty()
  password: string;
}
