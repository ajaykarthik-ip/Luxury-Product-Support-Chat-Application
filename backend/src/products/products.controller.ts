import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  // Public: anyone can browse the catalog without signing in. Login is only
  // required when a customer takes an action (starting a conversation).
  @Public()
  @Get()
  findAll() {
    return this.products.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.products.findOne(id);
  }

  // Only agents can add products (acts as our admin/seed path).
  @Roles(Role.AGENT)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }
}
