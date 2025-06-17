import { PartialType } from "@nestjs/swagger";
import { CreateReclamationDto } from "./createreclamation.dtos";

export class UpdateReclamationDto extends PartialType(CreateReclamationDto) {}