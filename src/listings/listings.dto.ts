import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateInquiryDto {
  @IsInt()
  @Min(1)
  listingId!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message!: string;
}

export class UpdatePriceDto {
  @IsInt()
  @Min(0)
  @Max(2000000000)
  priceCents!: number;
}
