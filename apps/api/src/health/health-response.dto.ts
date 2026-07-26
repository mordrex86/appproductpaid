import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({
    enum: ['ok'],
    example: 'ok',
    type: String,
  })
  readonly status = 'ok';
}
