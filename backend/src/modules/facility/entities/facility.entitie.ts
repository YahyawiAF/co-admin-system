import { ApiProperty } from '@nestjs/swagger';

export class FacilityEntity {
  constructor(partial: Partial<FacilityEntity>) {
    Object.assign(this, partial);
  }

  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  numtel: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  adresse: string;

  @ApiProperty({ 
    example: 'https://example.com/logo.png',
    required: false 
  })
  logo?: string;

  @ApiProperty({ 

    description: 'Nombre total de places disponibles' 
  })
  nbrPlaces: number;

  @ApiProperty()
  socialNetworks: Record<string, string>;

  @ApiProperty()
  places: Record<string, number>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}