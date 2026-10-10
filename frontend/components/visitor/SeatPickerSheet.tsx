"use client";

import { BottomSheet } from "@/components/visitor/BottomSheet";
import { VisitorSeatMap } from "@/components/visitor/VisitorSeatMap";
import type { MobileSeatMode, SeatAssignmentInfo } from "@/lib/types";

export function SeatPickerSheet({
  open,
  onOpenChange,
  memberId,
  seat,
  seatMode,
  canPick,
  allowedSpaceIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  seat: SeatAssignmentInfo | null;
  seatMode: MobileSeatMode | null;
  canPick: boolean;
  allowedSpaceIds?: string[];
}) {
  const seatLabel = seat?.seatLabel || null;
  const where = [seat?.spaceName, seat?.tableName, seatLabel]
    .filter(Boolean)
    .join(" · ");

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={canPick ? "Choisir ma place" : "Ma place"}
      description={
        canPick
          ? "Touchez une place libre pour la réserver."
          : `${where}${seat?.isOverflow ? " · Overflow" : ""}`
      }
    >
      <VisitorSeatMap
        memberId={memberId}
        assignedSeatLabel={seatLabel}
        assignedSpaceId={seat?.spaceId}
        seatMode={seatMode}
        canPick={canPick}
        allowedSpaceIds={allowedSpaceIds}
      />
    </BottomSheet>
  );
}
