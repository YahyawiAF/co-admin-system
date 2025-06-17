import { PartialType } from "@nestjs/swagger/dist/type-helpers/partial-type.helper";
import { CreateResponseDto } from "./createreponse.dtos";

export class UpdateResponseDto extends PartialType(CreateResponseDto) {}