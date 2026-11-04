import { z } from "zod";

export const loginSchema = z.object({
  identity: z.string().trim().min(1).max(100),
  pin: z.string().regex(/^\d{4,12}$/),
  device: z
    .object({
      deviceId: z.string().trim().min(1).max(255),
      deviceName: z.string().trim().min(1).max(255).optional(),
      platform: z.string().trim().min(1).max(100).optional(),
      appVersion: z.string().trim().min(1).max(50).optional(),
    })
    .optional(),
});

export const attendanceScanSchema = z.object({
  qrToken: z.string().min(32).max(512),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().nonnegative(),
  deviceId: z.string().trim().min(1).max(255).optional(),
  idempotencyKey: z.string().trim().min(16).max(150),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type AttendanceScanInput = z.infer<typeof attendanceScanSchema>;