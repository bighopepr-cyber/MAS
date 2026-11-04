import { AccountType } from "@mas/database";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class UserProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nrp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  memberNumber?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  rank?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  position?: string;
}

export class CreateUserDto {
  @IsString()
  @Length(1, 100)
  username!: string;

  @IsString()
  @Matches(/^\d{4,12}$/)
  pin!: string;

  @IsEnum(AccountType)
  accountType!: AccountType;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserProfileDto)
  profile?: UserProfileDto;
}