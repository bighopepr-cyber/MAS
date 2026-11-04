import { ProfileType } from "@mas/database";
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from "class-validator";

export class CreateAttendancePolicyDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @IsEnum(ProfileType)
  profileType?: ProfileType;

  @IsString()
  @Length(1, 150)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(10080)
  overdueAfterMinutes!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveUntil?: string;
}