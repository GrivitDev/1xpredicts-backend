import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class GeneratePredictionDto {
  @IsInt()
  @IsPositive()
  fixtureId!: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  forceRefresh?: number;
}
