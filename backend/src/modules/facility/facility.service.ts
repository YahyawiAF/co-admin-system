import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { FacilityEntity } from './entities/facility.entitie';
import { UpdateFacilityDto } from './dtos/updateFac.dto';
import { CreateFacilityDto } from './dtos/createfac.dto';

@Injectable()
export class FacilityService {
  constructor(private readonly prisma: PrismaService) {}

  private toFacilityEntity(facility: any): FacilityEntity {
    return new FacilityEntity({
      ...facility,
      socialNetworks: facility.socialNetworks as Record<string, string>,
      places: facility.places as Record<string, number>
    });
  }

  async create(createFacilityDto: CreateFacilityDto): Promise<FacilityEntity> {
    try {
      const facility = await this.prisma.facility.create({
        data: {
          ...createFacilityDto,
          socialNetworks: createFacilityDto.socialNetworks || {},
          places: createFacilityDto.places || {},
        },
      });

      return this.toFacilityEntity(facility);
    } catch (error) {
      console.error('Error creating facility:', error);
      throw error;
    }
  }

  async findAll(): Promise<FacilityEntity[]> {
    const facilities = await this.prisma.facility.findMany();
    return facilities.map(facility => this.toFacilityEntity(facility));
  }

  async findOne(id: string): Promise<FacilityEntity> {
    const facility = await this.prisma.facility.findUnique({
      where: { id },
    });

    if (!facility) {
      throw new NotFoundException(`Facility with ID ${id} not found`);
    }

    return this.toFacilityEntity(facility);
  }

  async update(id: string, updateFacilityDto: UpdateFacilityDto): Promise<FacilityEntity> {
    const existingFacility = await this.prisma.facility.findUnique({
      where: { id },
    });

    if (!existingFacility) {
      throw new NotFoundException(`Facility with ID ${id} not found`);
    }

    const updatedFacility = await this.prisma.facility.update({
      where: { id },
      data: {
        ...updateFacilityDto,
        socialNetworks: updateFacilityDto.socialNetworks !== undefined 
          ? updateFacilityDto.socialNetworks 
          : existingFacility.socialNetworks,
        places: updateFacilityDto.places !== undefined 
          ? updateFacilityDto.places 
          : existingFacility.places,
      },
    });

    return this.toFacilityEntity(updatedFacility);
  }

  async remove(id: string): Promise<void> {
    const facility = await this.prisma.facility.findUnique({
      where: { id },
    });

    if (!facility) {
      throw new NotFoundException(`Facility with ID ${id} not found`);
    }

    await this.prisma.facility.delete({
      where: { id },
    });
  }
}