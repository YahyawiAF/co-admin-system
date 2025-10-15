export interface EnhancedTableHeadProps<T = any> {
  numSelected: number;
  order: "desc" | "asc";
  orderBy: keyof T;
  rowCount: number;
  onSelectAllClick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRequestSort: (e: React.MouseEvent<unknown>, property: keyof T) => void;
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
