import { FC, useState, useEffect } from "react";
import { useFormContext, Controller } from "react-hook-form";
import {
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
  Box,
  TextField,
} from "@mui/material";
import { SelectChangeEvent } from "@mui/material/Select";
import { styled } from "@mui/system";

interface TimeInterval {
  start: string;
  end: string;
}

interface Price {
  id: string;
  name: string;
  price: number;
  timePeriod: TimeInterval;
  createdAt: Date | null;
  updatedAt: Date | null;
  type: string;
}

type IRHFTextField = {
  name: string;
  list?: Price[];
  label?: string;
  onhandleManuelUpdae?: () => void;
};

const formatTimeInterval = (interval: TimeInterval) => {
  return `${interval.start} - ${interval.end}`;
};

const RHSelectRate: FC<IRHFTextField> = ({
  name,
  list = [],
  label,
  onhandleManuelUpdae,
}) => {
  const { control, setValue, watch } = useFormContext();
  const selectedId = watch(name); // Obtenir la valeur actuelle du champ sélectionné
  const [selectedPrice, setSelectedPrice] = useState<Price | null>(null);

  // Mettre à jour selectedPrice lorsque selectedId change
  useEffect(() => {
    const newSelectedPrice = list.find((price) => price.id === selectedId) || null;
    setSelectedPrice(newSelectedPrice);
  }, [selectedId, list]);

  const handleChange = (event: SelectChangeEvent<string>) => {
    const selectedId = event.target.value;
    setValue(name, selectedId, { shouldValidate: true });
    onhandleManuelUpdae?.();
  };

  useEffect(() => {
    if (list.length > 0 && !selectedId) {
      setValue(name, list[0].id, { shouldValidate: true });
    }
  }, [list, selectedId, setValue, name]);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <StyledDropDown fullWidth error={!!error}>
          {label && <InputLabel>{label}</InputLabel>}
          <Select
            {...field}
            value={field.value || ""}
            onChange={handleChange}
            label={label}
            error={!!error}
           
          >
            {list.map((price) => (
              <MenuItem key={price.id} value={price.id}>
                {`${price.name} `}
                
              </MenuItem>
              
            ))}
          </Select>
          {!!error && <FormHelperText error>{error?.message}</FormHelperText>}
          {selectedPrice && (
            <Box sx={{ marginTop: 2, display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="Prix"
                value={`${selectedPrice.price} DT`}
                disabled
                fullWidth
                sx={{
                  "& .MuiInputBase-input.Mui-disabled": {
                    color: "black",
                    WebkitTextFillColor: "black",
                  },
                }}
              />
              <TextField
                label="Période"
                value={formatTimeInterval(selectedPrice.timePeriod)}
                disabled
                fullWidth
                sx={{
                  "& .MuiInputBase-input.Mui-disabled": {
                    color: "black",
                    WebkitTextFillColor: "black",
                  },
                }}
              />
              <TextField
                label="Type"
                value={selectedPrice.type}
                disabled
                fullWidth
                sx={{
                  "& .MuiInputBase-input.Mui-disabled": {
                    color: "black",
                    WebkitTextFillColor: "black",
                  },
                }}
              />
            </Box>
          )}
        </StyledDropDown>
      )}
    />
  );
};

const StyledDropDown = styled(FormControl)(() => ({
  width: "100%",
  ["#mui-component-select-role"]: {
    padding: "7.5px 14px",
  },
}));

export default RHSelectRate;
