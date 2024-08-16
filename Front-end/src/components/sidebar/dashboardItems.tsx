import { SidebarItemsType } from "../../types/sidebar";

import { Sliders, Repeat, User, CreditCard, Activity } from "react-feather";

const pagesSection = [
  {
    href: "/",
    icon: Sliders,
    title: "Dashboard",
  },
  {
    href: "/dashboard/journal",
    icon: Activity,
    title: "Journal",
  },
  {
    href: "/dashboard/transactions",
    icon: Repeat,
    title: "Transactions",
  },
  {
    href: "/dashboard/members",
    icon: User,
    title: "Members",
  },
  {
    href: "/dashboard/cards",
    icon: CreditCard,
    title: "Cards",
  },
] as SidebarItemsType[];

const navItems = [
  {
    title: "Pages",
    pages: pagesSection,
  },
];

export default navItems;
