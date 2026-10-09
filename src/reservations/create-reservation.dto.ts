import { IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateReservationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  itemId!: string;

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  quantity!: number;
}
