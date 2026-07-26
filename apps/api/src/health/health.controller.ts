import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './health-response.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Consultar la disponibilidad de la API',
  })
  @ApiOkResponse({
    description: 'La API está disponible.',
    type: HealthResponseDto,
  })
  getHealth(): HealthResponseDto {
    return new HealthResponseDto();
  }
}
