import { Type } from "class-transformer";
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class LoginDeviceDto {
  @IsString()
  @Length(1, 255)
  deviceId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  appVersion?: string;
}

export class LoginDto {
  @IsString()
  @Length(1, 100)
  identity!: string;

  @IsString()
  @Matches(/^\d{4,12}$/)
  pin!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LoginDeviceDto)
  device?: LoginDeviceDto;
}