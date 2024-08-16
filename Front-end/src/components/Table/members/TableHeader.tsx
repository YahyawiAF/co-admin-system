import { FC, ReactNode, ChangeEvent } from "react";
import {
  Box,
  Button,
  IconButton as MUIIconButton,
  TextField,
  Toolbar,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { Search, AddCircleTwoTone, Refresh } from "@mui/icons-material";
import { spacing } from "@mui/system";
import { MobileDatePicker } from "@mui/x-date-pickers";

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
  search?: string;
  refetch?: any;
  toDay?: Date;
  handleChangeDate: (date: Date | null) => void;
}

const BulkActions: FC<IBulkActions> = ({
  handleClickOpen,
  onHandleSearch,
  search,
  refetch,
  toDay,
  handleChangeDate,
}) => {
  return (
    <Toolbar sx={{ justifyContent: refetch ? "space-between" : "flex-end" }}>
      {refetch && (
        <Box display="flex" alignItems="center">
          <Box display="flex" alignItems="center" mr="5px">
            <Button
              variant="outlined"
              endIcon={<Refresh />}
              onClick={() => refetch()}
              // style={{
              //   padding: "6.5px 10px",
              // }}
            >
              Refresh
            </Button>
          </Box>
          <Box display="flex" alignItems="center">
            <MobileDatePicker
              value={toDay}
              onChange={(value) => handleChangeDate(value)}
              slotProps={{
                textField: {
                  style: {
                    padding: "7.5px 10px !important",
                    borderRadius: 0,
                  },
                  size: "small",
                  fullWidth: true,
                  // error: !!error,
                  // helperText: error?.message,
                  // ...other,
                },
              }}
            />
          </Box>
        </Box>
      )}
      <div>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            <CustomTextField
              placeholder="Search"
              value={search}
              onChange={onHandleSearch}
              InputProps={{
                endAdornment: <Search />,
              }}
            />
            <IconCustomButton onClick={() => handleClickOpen()}>
              <AddCircleTwoTone />
            </IconCustomButton>
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
