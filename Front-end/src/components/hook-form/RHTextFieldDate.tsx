import { FC } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { TextFieldProps } from "@mui/material";
import { DesktopDatePicker, MobileTimePicker } from "@mui/x-date-pickers";
import { format } from "date-fns";

type IRHFTextField = {
  name: string;
  isMin?: boolean;
} & TextFieldProps;

const RHFTextField: FC<IRHFTextField> = ({ name, isMin, ...other }) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({
        field: { value, onChange, ...field },
        fieldState: { error },
      }) => {
        const date = value ? new Date(value) : null;
        return (
          <DesktopDatePicker
            {...field}
            // views={["year", "month", "day"]}
            // openTo="year"
            maxDate={isMin ? undefined : new Date()}
            minDate={isMin ? new Date() : undefined}
            value={date}
            onChange={(value) =>
              onChange(new Date(format(value as Date, "yyyy-MM-dd HH:mm:ss")))
            }
            slotProps={{
              textField: {
                fullWidth: true,
                variant: "outlined",
                error: !!error,
                helperText: error?.message,
                ...other,
              },
            }}
          />
        );
      }}
    />
  );
};

export const RHFTimePeakerField: FC<IRHFTextField> = ({ name, ...other }) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({
        field: { value, onChange, ...field },
        fieldState: { error },
      }) => {
        console.log("value", value);
        const date = value ? new Date(value) : null;
        return (
          <MobileTimePicker
            {...field}
            value={date}
            onChange={(value) => onChange(value)}
            slotProps={{
              textField: {
                fullWidth: true,
                variant: "outlined",
                error: !!error,
                helperText: error?.message,
                ...other,
              },
            }}
          />
        );
      }}
    />
  );
};

export default RHFTextField;
