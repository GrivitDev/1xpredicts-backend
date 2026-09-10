import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

export class PredictionPlaygroundSelectionDto {
  @IsInt()
  @Type(() => Number)
  fixtureId!: number;

  @IsString()
  @IsNotEmpty()
  market!: string;

  @IsString()
  @IsNotEmpty()
  selection!: string;
}

export class PredictionPlaygroundDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({
    each: true,
  })
  @Type(() => PredictionPlaygroundSelectionDto)
  selections!: PredictionPlaygroundSelectionDto[];
}
