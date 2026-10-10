import { Role } from '../lib/roles';

// Augments Express' Request with the authenticated user attached by `authenticate`.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        name: string;
        email: string;
        employeeId: string;
      };
    }
  }
}

export {};
