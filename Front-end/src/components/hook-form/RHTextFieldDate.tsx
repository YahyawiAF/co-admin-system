import { FC } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { TextFieldProps } from "@mui/material";
import {
  DesktopDatePicker,
  MobileTimePicker,
  MobileDateTimePicker,
  MobileTimePickerProps,
  MobileDateTimePickerProps,
} from "@mui/x-date-pickers";
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

type IRHFTimePeakerField = IRHFTextField & MobileTimePickerProps<Date>;
export const RHFTimePeakerField: FC<IRHFTimePeakerField> = ({
  name,
  minTime,
  ...other
}) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({
        field: { value, onChange, ...field },
        fieldState: { error },
      }) => {
        const date = value ? new Date(value) : new Date();
        return (
          <MobileTimePicker
            {...field}
            value={date}
            onChange={(value) => onChange(value)}
            minTime={minTime}
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

type IRHFDatePeakerField = IRHFTextField & MobileDateTimePickerProps<Date>;
export const RHFDatePeakerField: FC<IRHFDatePeakerField> = ({
  name,
  minDate,
  ...other
}) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({
        field: { value, onChange, ...field },
        fieldState: { error },
      }) => {
        const date = value ? new Date(value) : new Date();
        return (
          <MobileDateTimePicker
            {...field}
            value={date}
            onChange={(value) => onChange(value)}
            // minTime={minTime}
            minDate={minDate}
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
