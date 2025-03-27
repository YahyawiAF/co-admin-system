import { SidebarItemsType } from "../../types/sidebar";
import { Sliders, User, Activity, Settings, DollarSign ,Users } from "react-feather"; 

const pagesSection = [
  {
    href: "/dashboard/landing",
    icon: Sliders,
    title: "Dashboard",
  },
  {
    href: "/dashboard/journal",
    icon: Activity,
    title: "Journal",
  },
  {
    href: "/dashboard/members",
    icon: User,
    title: "Members",
  },
  {
    href: "/dashboard/abonnement",
    icon: Users,
    title: "Membership",
  },
  {
    href: "",
    icon: Settings,
    title: "Settings",
    children: [  
      {
        href: "/dashboard/price",
        icon: DollarSign,
        title: "Rate",
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
