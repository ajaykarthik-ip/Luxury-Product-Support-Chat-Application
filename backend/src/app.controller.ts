import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Public so the root health check works without a token (the global
  // JwtAuthGuard would otherwise require one on every route).
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
