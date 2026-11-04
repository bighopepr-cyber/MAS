import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class AttendanceScanDto {
  @IsString()
  @MinLength(32)
  @MaxLength(512)
  qrToken!: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  accuracy!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceId?: string;

  @IsString()
  @MinLength(16)
  @MaxLength(150)
  idempotencyKey!: string;
}