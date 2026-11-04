import { IsOptional, IsString, IsUUID, Length, MaxLength } from "class-validator";

export class CreateOrganizationDto {
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsString()
  @Length(1, 100)
  code!: string;

  @IsString()
  @Length(1, 200)
  name!: string;

  @IsString()
  @MaxLength(100)
  organizationType!: string;
}