import { Module } from '@nestjs/common';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { ProjectsModule } from '../projects/projects.module';
import { BuildsModule } from '../builds/builds.module';

@Module({
  imports: [ProjectsModule, BuildsModule],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
