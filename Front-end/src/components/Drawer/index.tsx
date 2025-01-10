// components
import { FC, ReactNode } from "react";
import Drawer from "@mui/material/Drawer";
import { Box } from "@mui/material";
// ----------------------------------------------------------------------

interface IShopFilterSidebar {
  open: boolean;
  handleClose: () => void;
  children: ReactNode;
}

const ShopFilterSidebar: FC<IShopFilterSidebar> = ({
  open,
  handleClose,
  children,
}) => {
  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={(e, raison) => raison !== "backdropClick" && handleClose()}
        PaperProps={{
          lg: { width: 440, border: "none", overflow: "hidden" },
          sx: { width: { sm: "100%", lg: 440 }, overflow: "hidden" },
        }}
      >
        <Box
          sx={{
            overflowY: "auto", // Enable vertical scrolling
            height: "100%", // Ensure it takes up the full height of the drawer
          }}
        >
          {children}
        </Box>
      </Drawer>
    </>
  );
};

export default ShopFilterSidebar;
