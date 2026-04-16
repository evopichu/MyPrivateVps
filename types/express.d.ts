import { IUser } from '../models/User';
import { IAdmin } from '../models/Admin';

declare global {
  namespace Express {
    interface User extends IUser {}
    
    interface Request {
      user?: User;
      admin?: IAdmin;
    }
  }
}

export {};
