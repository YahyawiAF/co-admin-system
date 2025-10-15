import React from "react";
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
} from "@mui/material";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import { useAuth } from "src/hooks/useAuth";
import { Role } from "src/types/shared";

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  roles: Role[];
  children?: NavigationItem[];
}

interface RoleBasedNavigationProps {
  items: NavigationItem[];
  onItemClick: (path: string) => void;
}

const RoleBasedNavigation: React.FC<RoleBasedNavigationProps> = ({
  items,
  onItemClick,
}) => {
  const { user } = useAuth();
  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);

  const hasPermission = (item: NavigationItem): boolean => {
    if (!user) return false;
    return item.roles.includes(user.role);
  };

  const handleItemClick = (item: NavigationItem) => {
    if (item.children && item.children.length > 0) {
      // Toggle expand/collapse for items with children
      setExpandedItems((prev) =>
        prev.includes(item.id)
          ? prev.filter((id) => id !== item.id)
          : [...prev, item.id]
      );
    } else {
      // Navigate to the item's path
      onItemClick(item.path);
    }
  };

  const renderNavigationItem = (item: NavigationItem, level = 0) => {
    if (!hasPermission(item)) {
      return null;
    }

    const isExpanded = expandedItems.includes(item.id);
    const hasChildren = item.children && item.children.length > 0;

    return (
      <React.Fragment key={item.id}>
        <ListItem
          button
          onClick={() => handleItemClick(item)}
          sx={{
            pl: 2 + level * 2,
            "&:hover": {
              backgroundColor: "rgba(0, 0, 0, 0.04)",
            },
          }}
        >
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText primary={item.label} />
          {hasChildren && (isExpanded ? <ExpandLess /> : <ExpandMore />)}
        </ListItem>

        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children
                ?.filter(hasPermission)
                .map((child) => renderNavigationItem(child, level + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  return <List>{items.map((item) => renderNavigationItem(item))}</List>;
};

export default RoleBasedNavigation;
