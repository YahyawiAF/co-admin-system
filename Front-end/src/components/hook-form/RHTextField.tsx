import { FC } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { TextField, TextFieldProps } from "@mui/material";

type IRHFTextField = {
  name: string;
} & TextFieldProps;

const RHFTextField: FC<IRHFTextField> = ({ InputProps, name, ...other }) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <TextField
          size="small"
          {...field}
          fullWidth
          onChange={(event) => {
            const v =
              other.type === "number"
                ? parseFloat(event.target.value)
                : event.target.value;
            field.onChange(v);
          }}
          value={
            typeof field.value === "number" && field.value === 0
              ? ""
              : field.value ?? ""
          }
          helperText={error?.message}
          error={!!error}
          {...other}
          InputProps={InputProps}
        />
      )}
    />
  );
};

export default RHFTextField;
