import { SidebarItemsType } from "../../types/sidebar";
import {
  Sliders,
  User,
  Activity,
  Settings,
  DollarSign,
  Users,
  CreditCard,
  TrendingUp,
  Briefcase,
  Tag,
  Box,
  Package,
  Home,
} from "react-feather";

const pagesSection = [
  {
    href: "/dashboard/landing",
    icon: Sliders,
    title: "Dashboard",
  },
  {
    href: "/dashboard/journal",
    icon: CreditCard,
    title: "Subscription",
  },
  {
    href: "/dashboard/members",
    icon: User,
    title: "Members",
  },

  {
    href: "",
    icon: Settings,
    title: "Settings",
    children: [
      {
        href: "/dashboard/price",
        icon: Tag,
        title: "Rate",
      },
      {
        href: "/dashboard/expense",
        icon: DollarSign,
        title: "Expense",
      },
      {
        href: "/dashboard/product",
        icon: Package,
        title: "Product",
      },
      {
        href: "/dashboard/facility",
        icon: Home,
        title: "Facility",
      },
    ],
  },
] as SidebarItemsType[];

const navItems = [
  {
    title: "Pages",
    pages: pagesSection,
  },
];

export default navItems;
