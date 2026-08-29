import { Module } from '@nestjs/common';

import { DatabaseModule } from 'src/database/database.module';
import { UserService } from './users.service';
import { UserController } from './users.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
