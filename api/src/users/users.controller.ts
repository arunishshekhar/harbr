import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  async findAll() { return this.users.findAll(); }

  @Get(':id')
  async findById(@Param('id') id: string) { return this.users.findById(id); }

  @Post()
  async create(@Body() body: { username: string; email?: string; password: string; role?: string }) {
    return this.users.create(body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.users.update(id, body);
  }
}
