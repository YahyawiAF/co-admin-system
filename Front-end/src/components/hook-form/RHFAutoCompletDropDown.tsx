import React from "react";
import {
  TextField,
  Autocomplete,
  TextFieldProps,
  AutocompleteProps,
} from "@mui/material";
import { useFormContext, Controller } from "react-hook-form";

type IRHFTextFieldAutoComplet = {
  name: string;
  defaultProps: {
    options: any[];
    getOptionLabel: (option: any) => any;
  };
  selectedItem: any | undefined | null;
  handleSelection: (event: any) => void;
  label: string;
  disabled?: boolean;
  error?: boolean;
  errorMessage?: string;
  multiple: boolean;
  // views: CalendarPickerView;
} & TextFieldProps;

const AutoCompletDropDown: React.FC<IRHFTextFieldAutoComplet> = ({
  defaultProps,
  selectedItem,
  handleSelection,
  label,
  disabled,
  error,
  errorMessage,
  placeholder,
  name,
  multiple = true,
  ...other
}) => {
  const { control } = useFormContext();
  //
  return (
    <>
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState: { error } }) => (
          <Autocomplete
            multiple={multiple}
            {...defaultProps}
            {...field}
            value={selectedItem || (multiple ? [] : null)}
            onChange={(event: any, newValue: any) => {
              handleSelection(newValue);
            }}
            disabled={Boolean(disabled)}
            // freeSolo={Boolean(disabled)}
            id="controllable-states-demo"
            sx={{ width: "100%" }}
            isOptionEqualToValue={(option, value) => option?.id === value?.id}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                fullWidth
                label={label}
                error={!!error}
                helperText={error?.message}
                {...other}
              />
            )}
          />
        )}
      />
    </>
  );
};

export default AutoCompletDropDown;
