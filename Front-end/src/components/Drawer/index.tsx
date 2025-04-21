import { FC, ReactNode } from "react";
import Drawer, { DrawerProps } from "@mui/material/Drawer";
import { Box } from "@mui/material";

interface IShopFilterSidebar extends DrawerProps {
  handleClose: () => void;
  children: ReactNode;
}

const ShopFilterSidebar: FC<IShopFilterSidebar> = ({
  open,
  handleClose,
  children,
  anchor = "right",
  PaperProps,
  ...props
}) => {
  return (
    <Drawer
      anchor={anchor}
      open={open}
      onClose={(event, reason) => {
        if (reason !== "backdropClick") {
          handleClose();
        }
      }}
      PaperProps={{
        ...PaperProps,
        sx: {
          width: { xs: "100%", sm: 440 },
          overflow: "hidden",
          ...PaperProps?.sx,
        },
      }}
      {...props}
    >
      <Box
        sx={{
          width: "100%",
          overflowY: "auto",
          height: "100%",
          p: 2,
        }}
      >
        {children}
      </Box>
    </Drawer>
  );
};

export default ShopFilterSidebar;