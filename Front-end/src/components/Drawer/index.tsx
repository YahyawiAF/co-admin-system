// components
import { FC, ReactNode } from "react";
import Drawer from "@mui/material/Drawer";
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
          sx: { width: 440, border: "none", overflow: "hidden" },
        }}
      >
        {children}
      </Drawer>
    </>
  );
};

export default ShopFilterSidebar;
