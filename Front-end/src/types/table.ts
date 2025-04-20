export interface EnhancedTableHeadProps {
  numSelected: number;
  order: "desc" | "asc";
  orderBy: string;
  rowCount: number;
  onSelectAllClick: (e: any) => void;
  onRequestSort: (e: any, property: string) => void;
  headCells: Array<HeadCell>;
  isMobile?: boolean;
}

export type HeadCell = {
  id: string;
  numeric: boolean;
  disablePadding: boolean;
  label: string;
  alignment?: "left" | "center" | "right" | "justify" | "inherit" | undefined;
};
