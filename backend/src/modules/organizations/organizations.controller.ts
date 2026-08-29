import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@ApiTags('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  list() {
    return this.organizationsService.list();
  }

  @Post()
  create(
    @Body()
    body: {
      name: string;
      slug: string;
      logo?: string | null;
      facebookUrl?: string | null;
      instagramUrl?: string | null;
    },
  ) {
    return this.organizationsService.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      slug: string;
      logo: string | null;
      facebookUrl: string | null;
      instagramUrl: string | null;
    }>,
  ) {
    return this.organizationsService.update(id, body);
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.organizationsService.findBySlug(slug);
  }
}
