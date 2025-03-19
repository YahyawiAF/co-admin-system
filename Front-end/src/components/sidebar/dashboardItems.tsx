import { SidebarItemsType } from "../../types/sidebar";
import { Sliders, User, Activity, Settings, DollarSign } from "react-feather"; // Assurez-vous d'importer l'icône DollarSign si vous voulez l'utiliser pour 'price'

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
    href: "/dashboard/cards",
    icon: Settings,
    title: "Settings",
  },
  {
    href: "/dashboard/price", // Ajoutez le lien pour la page 'price'
    icon: DollarSign,  // Exemple d'icône pour 'price', vous pouvez choisir une autre icône si nécessaire
    title: "Price",    // Titre de la section 'Price'
  },
] as SidebarItemsType[];

const navItems = [
  {
    title: "Pages",
    pages: pagesSection,
  },
];

export default navItems;
