import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  MinLength,
} from 'class-validator';

export class SignUpDto {
  @IsPhoneNumber('IN')
  phone: string;

  @IsOptional()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(6, { message: 'password must be atleast 6 charcter.' })
  password: string;

  @IsNotEmpty()
  @MinLength(6, { message: 'password must be atleast 6 charcter.' })
  confirm: string;

  @IsNotEmpty()
  @MinLength(3, { message: 'name must be atleast 3 charcter.' })
  name: string;
}
