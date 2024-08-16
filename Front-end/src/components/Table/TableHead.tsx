import { useState, FC, ReactNode, ChangeEvent } from "react";
import {
  Box,
  Menu,
  IconButton as MUIIconButton,
  TextField,
  Toolbar,
  Tooltip,
  Button,
  MenuItem,
  Fade,
} from "@mui/material";
import { styled } from "@mui/material/styles";

import { Search, ReceiptLong, Close } from "@mui/icons-material";
import { spacing } from "@mui/system";
import { blue, green, red } from "@mui/material/colors";
import { Filters } from "src/types/shared";

const IconButton = styled(MUIIconButton)(spacing);

const IconCustomButton = ({
  onClick,
  children,
}: {
  onClick: Function;
  children: ReactNode;
}) => (
  <IconButton color="primary" onClick={() => onClick()} sx={{ ml: 1, p: 1 }}>
    {children}
  </IconButton>
);

IconCustomButton.displayName = "IconCustomButton";

interface IBulkActions {
  handleClickOpen: Function;
  onHandleSearch: (event: ChangeEvent<HTMLInputElement>) => void;
  onHandleDate: (value: string) => void;
  onHandleMyTransaction: (value: boolean) => void;
  search?: string;
  filters?: Filters;
}

const BulkActions: FC<IBulkActions> = ({
  handleClickOpen,
  onHandleMyTransaction,
  onHandleSearch,
  onHandleDate,
  search,
  filters,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedValue, setSelectedValue] = useState("");

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuItemClick = (value: string) => {
    setSelectedValue(value);
    onHandleDate(value);
    handleClose();
  };

  return (
    <Toolbar sx={{ justifyContent: "flex-end" }}>
      <div>
        <Box display="flex" alignItems="center">
          <Box display="flex" alignItems="center">
            <CustomTextField
              placeholder="Search"
              value={search}
              onChange={onHandleSearch}
              InputProps={{
                endAdornment: <Search />,
              }}
            />
            <Box mx={2}>
              <IconCustomButton
                onClick={() => {
                  onHandleMyTransaction(!filters?.myTransaction);
                }}
              >
                <Tooltip title="My Transaction" arrow>
                  <ReceiptLong
                    sx={{
                      color: filters?.myTransaction ? green[400] : blue[400],
                    }}
                  />
                </Tooltip>
              </IconCustomButton>
            </Box>
            {selectedValue ? (
              <Button
                onClick={() => handleMenuItemClick("")}
                variant="outlined"
                color="primary"
              >
                {selectedValue}
                <Close style={{ marginLeft: "10px", color: red[200] }} />
              </Button>
            ) : (
              <Button
                aria-owns={anchorEl ? "simple-menu" : undefined}
                aria-haspopup="true"
                onClick={handleClick}
                variant="outlined"
                color="primary"
              >
                Transactions Date
              </Button>
            )}
            <Menu
              id="simple-menu"
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              TransitionComponent={Fade}
            >
              <MenuItem onClick={() => handleMenuItemClick("Last Week")}>
                Last Week
              </MenuItem>
              <MenuItem onClick={() => handleMenuItemClick("Last Month")}>
                Last Month
              </MenuItem>
              <MenuItem onClick={() => handleMenuItemClick("Last Year")}>
                Last Year
              </MenuItem>
            </Menu>
          </Box>
        </Box>
      </div>
    </Toolbar>
  );
};
const CustomTextField = styled(TextField)(
  () => `
    && {
      box-shadow: unset;
      border-radius:0;
      .MuiInputBase-root {
        border-radius: 0;
        input {
          padding: 7.5px 10px;
        }
      }
    }
`
);
export default BulkActions;
