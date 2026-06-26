import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

@Injectable()
export class TemplatesService {
  private templatesDir = path.join(process.cwd(), '..', 'templates');

  async findAll() {
    const files = await fs.readdir(this.templatesDir);
    const templates = [];
    for (const file of files) {
      if (!file.endsWith('.yaml') || file.startsWith('_')) continue;
      const content = await fs.readFile(path.join(this.templatesDir, file), 'utf-8');
      templates.push({ name: file.replace('.yaml', ''), content });
    }
    return templates;
  }

  async findByName(name: string) {
    const content = await fs.readFile(path.join(this.templatesDir, `${name}.yaml`), 'utf-8');
    return { name, content };
  }
}
