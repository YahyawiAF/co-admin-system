import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StockService } from './stock.service';

type S = StockService;

@Controller('stock')
@ApiTags('Stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  /** Everything the Produits & stock page shows: totals, products, ingredients, purchases, losses. */
  @Get('overview')
  overview(@Query('organizationId') organizationId?: string) {
    return this.stock.overview(organizationId);
  }

  @Post('items')
  createItem(@Body() body: Parameters<S['createItem']>[0]) {
    return this.stock.createItem(body);
  }

  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() body: Parameters<S['updateItem']>[1]) {
    return this.stock.updateItem(id, body);
  }

  @Delete('items/:id')
  removeItem(@Param('id') id: string) {
    return this.stock.removeItem(id);
  }

  @Post('items/:id/count')
  count(
    @Param('id') id: string,
    @Body() body: Parameters<S['count']>[1],
    @Query('organizationId') organizationId?: string,
  ) {
    return this.stock.count(id, body, organizationId);
  }

  @Delete('adjustments/:id')
  removeAdjustment(@Param('id') id: string) {
    return this.stock.removeAdjustment(id);
  }

  @Put('recipes/:productId')
  setRecipe(@Param('productId') productId: string, @Body() body: Parameters<S['setRecipe']>[1]) {
    return this.stock.setRecipe(productId, body);
  }

  @Post('purchases')
  createPurchase(@Body() body: Parameters<S['createPurchase']>[0]) {
    return this.stock.createPurchase(body);
  }

  @Delete('purchases/:id')
  removePurchase(@Param('id') id: string) {
    return this.stock.removePurchase(id);
  }
}
