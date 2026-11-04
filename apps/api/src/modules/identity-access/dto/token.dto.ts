import { IsString, Matches, MinLength } from "class-validator";

export class RefreshTokenDto {
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}

export class ChangePinDto {
  @IsString()
  @Matches(/^\d{4,12}$/)
  currentPin!: string;

  @IsString()
  @Matches(/^\d{4,12}$/)
  newPin!: string;
}