import { IsOptional, IsString, Length, Matches, MaxLength } from "class-validator";

export class ResetPinDto {
  @IsString()
  @Matches(/^\d{4,12}$/)
  newPin!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}