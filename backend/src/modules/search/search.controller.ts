import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { PublicSearchQueryDto } from './dto/public-search.dto';

@Controller('public')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('search')
  async search(@Query() query: PublicSearchQueryDto) {
    return this.searchService.searchPublicNetwork(query);
  }

  @Get('locations')
  async getLocations() {
    return this.searchService.getAvailableLocations();
  }
}
