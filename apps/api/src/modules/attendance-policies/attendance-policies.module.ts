import { Module } from "@nestjs/common";
import { AuthModule } from "../identity-access/auth.module";
import { AttendancePoliciesController } from "./attendance-policies.controller";
import { AttendancePoliciesService } from "./attendance-policies.service";

@Module({
  imports: [AuthModule],
  controllers: [AttendancePoliciesController],
  providers: [AttendancePoliciesService],
})
export class AttendancePoliciesModule {}