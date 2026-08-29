import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import {
  AddGroupMemberDto,
  CreateMemberGroupDto,
  UpdateMemberGroupDto,
} from './dtos/group.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId?: string) {
    return this.prisma.memberGroup.findMany({
      where: organizationId ? { organizationId } : undefined,
      include: {
        members: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            visitorNumber: true,
            groupId: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const group = await this.prisma.memberGroup.findUnique({
      where: { id },
      include: {
        members: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            visitorNumber: true,
            groupId: true,
          },
        },
      },
    });
    if (!group) throw new NotFoundException('Groupe introuvable');
    return group;
  }

  async create(dto: CreateMemberGroupDto) {
    let organizationId = (dto as { organizationId?: string }).organizationId;
    if (!organizationId) {
      const org = await this.prisma.organization.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!org) throw new BadRequestException('Aucune organisation configurée');
      organizationId = org.id;
    }
    return this.prisma.memberGroup.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        maxMembers: dto.maxMembers ?? 15,
        discountForfait: dto.discountForfait ?? 0,
        discountSalle: dto.discountSalle ?? 0,
        discountOpenSpace: dto.discountOpenSpace ?? 0,
      },
      include: { members: true },
    });
  }

  async update(id: string, dto: UpdateMemberGroupDto) {
    await this.findOne(id);
    return this.prisma.memberGroup.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.maxMembers != null ? { maxMembers: dto.maxMembers } : {}),
        ...(dto.discountForfait != null
          ? { discountForfait: dto.discountForfait }
          : {}),
        ...(dto.discountSalle != null
          ? { discountSalle: dto.discountSalle }
          : {}),
        ...(dto.discountOpenSpace != null
          ? { discountOpenSpace: dto.discountOpenSpace }
          : {}),
      },
      include: { members: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.member.updateMany({
      where: { groupId: id },
      data: { groupId: null },
    });
    return this.prisma.memberGroup.delete({ where: { id } });
  }

  async addMember(groupId: string, dto: AddGroupMemberDto) {
    const group = await this.findOne(groupId);
    const member = await this.prisma.member.findUnique({
      where: { id: dto.memberId },
    });
    if (!member) throw new NotFoundException('Membre introuvable');
    if (member.groupId === groupId) return this.findOne(groupId);
    const count = group.members.filter((m) => m.id !== dto.memberId).length;
    if (count >= group.maxMembers) {
      throw new BadRequestException(
        `Groupe plein (${group.maxMembers} membres max)`,
      );
    }
    await this.prisma.member.update({
      where: { id: dto.memberId },
      data: { groupId },
    });
    return this.findOne(groupId);
  }

  async removeMember(groupId: string, memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException('Membre introuvable');
    if (member.groupId !== groupId) {
      throw new BadRequestException("Ce membre n'est pas dans ce groupe");
    }
    await this.prisma.member.update({
      where: { id: memberId },
      data: { groupId: null },
    });
    return this.findOne(groupId);
  }
}
