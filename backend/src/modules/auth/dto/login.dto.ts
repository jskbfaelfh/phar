import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'يرجى إدخال معرف الصيدلية' })
  pharmacySlug: string;

  @IsString()
  @IsNotEmpty({ message: 'يرجى إدخال اسم المستخدم' })
  username: string;

  @IsString()
  @MinLength(4, { message: 'كلمة المرور يجب أن لا تقل عن 4 أحرف' })
  password: string;
}

export class AdminLoginDto {
  @IsString()
  @IsNotEmpty({ message: 'يرجى إدخال اسم مستخدم المدير' })
  username: string;

  @IsString()
  @MinLength(6, { message: 'كلمة المرور يجب أن لا تقل عن 6 أحرف' })
  password: string;
}
