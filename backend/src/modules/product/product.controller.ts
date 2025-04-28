import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    HttpCode,
    HttpStatus,
  } from '@nestjs/common';
  import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiCreatedResponse,
    ApiOkResponse,
  } from '@nestjs/swagger';
import { ProductsService } from './product.service';
import { ProductEntity } from './entities/product.entitie';
import { CreateProductDto } from './dtos/createProduct.dto';
import { UpdateProductDto } from './dtos/updateProduct';
  
  @Controller('products')
  @ApiTags('Products')
  export class ProductsController {
    constructor(private readonly productsService: ProductsService) {}
  
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new product' })
    @ApiCreatedResponse({
      description: 'The product has been successfully created.',
      type: ProductEntity,
    })
    async create(@Body() createProductDto: CreateProductDto) {
      return this.productsService.create(createProductDto);
    }
  
    @Get()
    @ApiOperation({ summary: 'Get all products' })
    @ApiOkResponse({
      description: 'List of all products',
      type: [ProductEntity],
    })
    async findAll() {
      return this.productsService.findAll();
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Get a product by ID' })
    @ApiParam({ name: 'id', description: 'Product ID' })
    @ApiOkResponse({
      description: 'The product details',
      type: ProductEntity,
    })
    @ApiResponse({
      status: 404,
      description: 'Product not found',
    })
    async findOne(@Param('id') id: string) {
      return this.productsService.findOne(id);
    }
  
    @Patch(':id')
    @ApiOperation({ summary: 'Update a product' })
    @ApiParam({ name: 'id', description: 'Product ID' })
    @ApiOkResponse({
      description: 'The product has been successfully updated.',
      type: ProductEntity,
    })
    @ApiResponse({
      status: 404,
      description: 'Product not found',
    })
    async update(
      @Param('id') id: string,
      @Body() updateProductDto: UpdateProductDto,
    ) {
      return this.productsService.update(id, updateProductDto);
    }
  
    @Delete(':id')
    @ApiOperation({ summary: 'Delete a product' })
    @ApiParam({ name: 'id', description: 'Product ID' })
    @ApiOkResponse({
      description: 'The product has been successfully deleted.',
      type: ProductEntity,
    })
    @ApiResponse({
      status: 404,
      description: 'Product not found',
    })
    async remove(@Param('id') id: string) {
      return this.productsService.remove(id);
    }



    @Post('daily')
    @ApiOperation({ summary: 'Create new daily product' })
    @ApiResponse({
      status: 201,
      description: 'Daily product successfully created',
    })
    async createDailyProduct(@Body() body: {productId?: string; quantite?: number }) {
      return this.productsService.createDailyProduct({
        productId: body.productId,
        quantite: body.quantite,
      });
    }
  
    @Patch('daily/:id')
    @ApiOperation({ summary: 'Update daily product' })
    @ApiParam({ name: 'id', description: 'Daily product ID' })
    @ApiResponse({
      status: 200,
      description: 'Daily product updated',
    })
    async updateDailyProduct(
      @Param('id') id: string,
      @Body() body: { productId?: string; quantite?: number },
    ) {
      return this.productsService.updateDailyProduct(id, {
        productId: body.productId,
        quantite: body.quantite,

      });
    }
  
    @Delete('daily/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete daily product' })
    @ApiParam({ name: 'id', description: 'Daily product ID' })
    @ApiResponse({
      status: 204,
      description: 'Daily product successfully deleted',
    })
    async removeDailyProduct(@Param('id') id: string) {
      return this.productsService.removeDailyProduct(id);
    }
  
    @Get('daily/all')
    @ApiOperation({ summary: 'Get all daily product' })
    @ApiResponse({
      status: 200,
      description: 'List of all daily product',
    })
    async findAllDailyProduct() {
      return this.productsService.findAllDailyProduct();
    }
  
    @Get('daily/:id')
    @ApiOperation({ summary: 'Get daily product by ID' })
    @ApiParam({ name: 'id', description: 'Daily product ID' })
    @ApiResponse({
      status: 200,
      description: 'Daily product details',
    })
    async findOneDailyProduct(@Param('id') id: string) {
      return this.productsService.findOneDailyProduct(id);
    }
  }