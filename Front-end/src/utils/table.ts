export function descendingComparator<T extends { [key: string]: any }>(
  a: T,
  b: T,
  orderBy: string
) {
  if (b[orderBy] < a[orderBy]) {
    return -1;
  }
  if (b[orderBy] > a[orderBy]) {
    return 1;
  }
  return 0;
}

export function stableSort<T>(
  array: T[],
  comparator: (a: T, b: T) => number
): T[] {
  const stabilizedThis = array.map((el, index) => ({
    el,
    index,
  }));
  stabilizedThis.sort((a, b) => {
    const order = comparator(a.el, b.el);
    if (order !== 0) return order;
    return a.index - b.index;
  });
  return stabilizedThis.map((element) => element.el);
}

export function getComparator<T extends Record<string, any>>(
  order: "desc" | "asc",
  orderBy: keyof T
): (a: T, b: T) => number {
  return order === "desc"
    ? (a: T, b: T) => descendingComparator(a, b, orderBy as string)
    : (a: T, b: T) => -descendingComparator(a, b, orderBy as string);
}

export function isDateInCurrentWeek(dateString: string) {
  var dateObj = new Date(dateString);

  var today = new Date();

  var startOfWeek = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - today.getDay()
  );

  var endOfWeek = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + (6 - today.getDay())
  );

  return dateObj >= startOfWeek && dateObj <= endOfWeek;
}

export function isDateInCurrentMonth(dateString: string) {
  var dateObj = new Date(dateString);

  var today = new Date();

  var currentYear = today.getFullYear();
  var currentMonth = today.getMonth();

  var yearOfDate = dateObj.getFullYear();
  var monthOfDate = dateObj.getMonth();

  return currentYear === yearOfDate && currentMonth === monthOfDate;
}

export function isDateInCurrentYear(dateString: string) {
  var dateObj = new Date(dateString);

  var today = new Date();

  var currentYear = today.getFullYear();
  var yearOfDate = dateObj.getFullYear();

  return currentYear === yearOfDate;
}
