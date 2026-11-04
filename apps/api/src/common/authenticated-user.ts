import type { AccountType } from "@mas/shared-types";

export interface AuthenticatedUser {
  id: string;
  username: string;
  accountType: AccountType;
  roles: string[];
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}