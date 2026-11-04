import { IsNumber, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min } from "class-validator";

export class CreateCheckpointDto {
  @IsUUID()
  organizationId!: string;

  @IsString()
  @Length(1, 100)
  code!: string;

  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.01)
  radiusMeter!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.01)
  accuracyLimitMeter!: number;
}