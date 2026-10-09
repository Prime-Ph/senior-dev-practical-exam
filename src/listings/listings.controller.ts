import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, DemoAuthGuard } from '../auth/demo-auth.guard';
import { InquiryRateLimitGuard } from '../rate-limit/inquiry-rate-limit.guard';
import { CreateInquiryDto, UpdatePriceDto } from './listings.dto';
import { ListingsService } from './listings.service';

@Controller()
@UseGuards(DemoAuthGuard)
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get('listings')
  list(@Req() request: AuthenticatedRequest, @Query('limit') value?: string) {
    const limit = value === undefined ? 10 : Number(value);
    if (value !== undefined && (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value))) {
      throw new BadRequestException('Invalid limit');
    }
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new BadRequestException('Limit must be 1-50');
    return this.listings.list(request.tenantId, limit);
  }

  @Get('summary')
  summary(@Req() request: AuthenticatedRequest) { return this.listings.summary(request.tenantId); }

  @Patch('listings/:id/price')
  updatePrice(@Req() request: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number, @Body() body: UpdatePriceDto) {
    return this.listings.updatePrice(request.tenantId, id, body.priceCents);
  }

  @Post('inquiries')
  @UseGuards(InquiryRateLimitGuard)
  inquire(@Req() request: AuthenticatedRequest, @Body() body: CreateInquiryDto) {
    return this.listings.inquire(request.tenantId, request.userId, body.listingId, body.message);
  }
}
