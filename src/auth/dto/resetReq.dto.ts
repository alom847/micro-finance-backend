import {
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  MinLength,
} from 'class-validator';

export class ResetReqDto {
  @IsNotEmpty()
  phone: string;
}

export class ResendOTPDto {
  @IsNotEmpty()
  @IsPhoneNumber('IN')
  phone: string;

  @IsNotEmpty()
  @IsString()
  type: string;
}
