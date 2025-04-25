import React, { FC, ReactNode, ChangeEvent } from "react";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import {
  InputAdornment,
  Box,
  Button,
  IconButton as MUIIconButton,
  TextField,
  Toolbar,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { Search, AddCircleTwoTone, Refresh } from "@mui/icons-material";
import { MobileDatePicker } from "@mui/x-date-pickers";

const IconButton = styled(MUIIconButton)``;

const IconCustomButton: FC<{
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}> = ({ onClick, children }) => (
  <IconButton color="primary" onClick={onClick} sx={{ ml: 1, p: 1 }}>
    {children}
  </IconButton>
);

IconCustomButton.displayName = "IconCustomButton";

interface IBulkActions {
  handleClickOpen: () => void;
  onHandleSearch: (event: ChangeEvent<HTMLInputElement>) => void;
  search?: string;
  refetch?: () => void;
  toDay?: Date;
  handleChangeDate?: (date: Date | null) => void;
  isMobile?: boolean;
  handleDailyExpenseClick?: () => void;
  showDailyExpenseButton?: boolean;
}

const BulkActions: FC<IBulkActions> = ({
  handleClickOpen,
  onHandleSearch,
  search,
  refetch,
  toDay,
  handleChangeDate,
  handleDailyExpenseClick,
  showDailyExpenseButton = false,
}) => {
  const isCurrentDay = () => {
    if (!toDay) return false;
    const today = new Date();
    return (
      toDay.getDate() === today.getDate() &&
      toDay.getMonth() === today.getMonth() &&
      toDay.getFullYear() === today.getFullYear()
    );
  };

  const goToNextDay = () => {
    if (handleChangeDate && toDay) {
      const nextDay = new Date(toDay);
      nextDay.setDate(nextDay.getDate() + 1);
      handleChangeDate(nextDay);
    }
  };

  const goToPreviousDay = () => {
    if (handleChangeDate && toDay) {
      const prevDay = new Date(toDay);
      prevDay.setDate(prevDay.getDate() - 1);
      handleChangeDate(prevDay);
    }
  };

  const setCurrentDay = () => {
    if (handleChangeDate) {
      handleChangeDate(new Date());
    }
  };

  return (
    <Toolbar
      sx={{
        justifyContent: "space-between",
        alignItems: "center",
        flexDirection: { xs: "column", md: "row" },
        gap: { xs: "10px", md: "unset" },
        marginBottom: { xs: "12px", md: "unset" },
      }}
    >
      <Box display="flex" alignItems="center" gap="10px">
        {handleChangeDate && (
          <Box display="flex" alignItems="center" gap="10px">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                position: "relative",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            >
              <Button
                onClick={goToPreviousDay}
                variant="outlined"
                startIcon={<KeyboardArrowLeftIcon />}
                style={{
                  minWidth: "0px",
                  padding: "0px",
                  margin: "0",
                  color: "blue",
                  borderWidth: "0px",
                  position: "absolute",
                  left: "5px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  zIndex: 1,
                }}
              />
              <MobileDatePicker
                value={toDay}
                onChange={(value) => handleChangeDate(value)}
                slotProps={{
                  textField: {
                    InputProps: {
                      disableUnderline: true,
                      style: {
                        border: "none",
                        outline: "none",
                        boxShadow: "none",
                        padding: "0px 35px",
                        textAlign: "center",
                        color: "#333",
                        fontWeight: "bold",
                        backgroundColor: "transparent",
                        width: "180px",
                      },
                    },
                    size: "small",
                    fullWidth: false,
                  },
                }}
              />
              <Button
                onClick={goToNextDay}
                variant="outlined"
                endIcon={<KeyboardArrowRightIcon />}
                style={{
                  minWidth: "0px",
                  padding: "0px",
                  margin: "0",
                  color: "blue",
                  borderWidth: "0px",
                  position: "absolute",
                  right: "5px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  zIndex: 1,
                }}
              />
            </div>
            <Button
              variant="outlined"
              color={isCurrentDay() ? "success" : "primary"}
              onClick={setCurrentDay}
              sx={{
                width: "120px",
                minWidth: "120px",
                padding: "6px 9px",
                marginLeft: "0px",
                backgroundColor: isCurrentDay()
                  ? "rgba(46, 125, 50, 0.08)"
                  : "inherit",
              }}
            >
              Current Day
            </Button>
            {showDailyExpenseButton && handleDailyExpenseClick && (
              <Button
                variant="contained"
                onClick={handleDailyExpenseClick}
                sx={{ ml: 2 }}
              >
                Daily Expense
              </Button>
            )}
          </Box>
        )}
      </Box>
      <Box display="flex" alignItems="center" gap="10px">
        {refetch && (
          <Box display="flex" alignItems="center">
            <Button
              variant="outlined"
              endIcon={<Refresh />}
              onClick={() => refetch()}
              sx={{ width: "120px", minWidth: "120px", padding: "5px 9px" }}
            >
              Refresh
            </Button>
          </Box>
        )}
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
    </Toolbar>
  );
};

const CustomTextField = styled(TextField)`
  && {
    box-shadow: unset;
    border-radius: 4px;
    .MuiInputBase-root {
      border-radius: 4px;
      input {
        padding: 7.5px 10px;
      }
    }
  }
`;

export default BulkActions;
