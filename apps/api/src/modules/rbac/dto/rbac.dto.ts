import { UserPermissionEffect } from "@mas/database";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class CreateRoleDto {
  @IsString()
  @Length(2, 100)
  name!: string;

  @IsString()
  @Length(1, 150)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @Length(1, 150)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignRoleScopeDto {
  @IsString()
  @Length(1, 30)
  type!: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;
}

export class AssignRoleDto {
  @IsUUID()
  roleId!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AssignRoleScopeDto)
  scope?: AssignRoleScopeDto;
}

export class AssignPermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  permissionIds!: string[];
}

export class CreatePermissionDto {
  @IsString()
  @Length(3, 150)
  key!: string;

  @IsString()
  @Length(1, 100)
  module!: string;

  @IsString()
  @Length(1, 150)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class DirectPermissionDto {
  @IsUUID()
  permissionId!: string;

  @IsEnum(UserPermissionEffect)
  effect!: UserPermissionEffect;
}