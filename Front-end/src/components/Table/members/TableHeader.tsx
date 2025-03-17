import React, { FC, ReactNode, ChangeEvent, useState } from "react";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import { InputAdornment, Box, Button, IconButton as MUIIconButton, TextField, Toolbar } from "@mui/material";
import { styled } from "@mui/material/styles";
import { Search, AddCircleTwoTone, Refresh } from "@mui/icons-material";
import { MobileDatePicker } from "@mui/x-date-pickers";

// Custom styled components
const IconButton = styled(MUIIconButton)``;

const IconCustomButton: FC<{ onClick: (event: React.MouseEvent<HTMLButtonElement>) => void; children: ReactNode }> = ({ onClick, children }) => (
  <IconButton color="primary" onClick={onClick} sx={{ ml: 1, p: 1 }}>
    {children}
  </IconButton>
);

IconCustomButton.displayName = "IconCustomButton";

// Interface for props
interface IBulkActions {
  handleClickOpen: () => void;
  onHandleSearch: (event: ChangeEvent<HTMLInputElement>) => void;
  search?: string;
  refetch?: () => void;
  toDay?: Date;
  handleChangeDate?: (date: Date | null) => void;
}

const BulkActions: FC<IBulkActions> = ({ handleClickOpen, onHandleSearch, search, refetch, toDay, handleChangeDate }) => {
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

  return (
    <Toolbar
    sx={{
      justifyContent: {
        xs: "flex-start",
        md: refetch ? "space-between" : "flex-end",
      },
      alignItems: { xs: "flex-start", md: "center" },
      flexDirection: { xs: "column", md: "row" },
      gap: { xs: "10px", md: "unset" },
      marginBottom: { xs: "12px", md: "unset" },
    }}
  >
    {/* Bouton Refresh et DatePicker */}
    {refetch && (
      <Box display="flex" alignItems="center">
        {/* Bouton Refresh */}
        <Box display="flex" alignItems="center" mr="5px">
        <Button
  variant="outlined"
  endIcon={<Refresh />}
  onClick={() => refetch()}
  sx={{ width: "120px", minWidth: "120px", padding: "6px 9px" }}
>
  Refresh
</Button>

        </Box>
  
        {/* Sélecteur de Date avec flèches */}
        {handleChangeDate && (
          <Box display="flex" alignItems="center">
          <div style={{ 
  display: "flex", 
  alignItems: "center", 
  position: "relative", 
  border: "1px solid #ccc",  // Bordure autour du champ de date
  borderRadius: "4px" 
}}>
  {/* Flèche gauche */}
  <Button
    onClick={goToPreviousDay}
    variant="outlined"
    startIcon={<KeyboardArrowLeftIcon />}
    style={{
      minWidth: "0px",
      padding: "0px",
      margin: "0",
      color: "black",
      borderWidth: "0px",
      position: "absolute",
      left: "5px", // Positionne la flèche à gauche à l’intérieur du champ
      top: "50%",
      transform: "translateY(-50%)",
      zIndex: 1,
    }}
  />
             {/* MobileDatePicker */}
             <MobileDatePicker
  value={toDay}
  onChange={(value) => handleChangeDate(value)}
  slotProps={{
    textField: {
      InputProps: {
        disableUnderline: true, // Supprime la ligne en bas
        style: {
          border: "none",
          outline: "none",
          boxShadow: "none",
          padding: "0px 35px", // Ajuste la hauteur (5px en haut/bas, 20px à gauche/droite)
          textAlign: "center",
          color: "#333",
          fontWeight: "bold",
          backgroundColor: "transparent",
          width: "180px", // Ajuste la largeur (200px est un exemple)
        },
      },
      size: "small",
      fullWidth: false, // Si vous ne voulez pas qu'il prenne toute la largeur
    },
  }}
/>



   {/* Flèche droite */}
   <Button
    onClick={goToNextDay}
    variant="outlined"
    endIcon={<KeyboardArrowRightIcon />}
    style={{
      minWidth: "0px",
      padding: "0px",
      margin: "0",
      color: "black",
      borderWidth: "0px",
      position: "absolute",
      right: "5px",  // Positionne la flèche à droite à l’intérieur du champ
      top: "50%",
      transform: "translateY(-50%)",
      zIndex: 1,
    }}
  />
</div>
          </Box>
        )}
      </Box>
    )}
  
    {/* Barre de recherche et bouton Ajouter */}
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
  </Toolbar>
  
  );
};

// Custom styled TextField
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
