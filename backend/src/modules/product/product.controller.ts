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
  }