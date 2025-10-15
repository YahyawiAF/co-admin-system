import React from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
} from "@mui/material";
import { Add, Search } from "@mui/icons-material";

interface TableHeadActionProps {
  search: string;
  handleClickOpen: () => void;
  onHandleSearch: (search: string) => void;
}

const TableHeadAction: React.FC<TableHeadActionProps> = ({
  search,
  handleClickOpen,
  onHandleSearch,
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      <Typography variant="h4" component="h2">
        Users Management
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <TextField
          size="small"
          placeholder="Search users..."
          value={search}
          onChange={(e) => onHandleSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 250 }}
        />

        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleClickOpen}
        >
          Add User
        </Button>
      </Box>
    </Box>
  );
};

export default TableHeadAction;
