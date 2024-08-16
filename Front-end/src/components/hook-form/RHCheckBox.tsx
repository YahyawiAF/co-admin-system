import { FC } from "react";
import { useFormContext, Controller, Control } from "react-hook-form";
import { Checkbox, FormControlLabel, CheckboxProps } from "@mui/material";

type IRHFTextField = CheckboxProps & {
  name: string;
  label: string;
};

const RHCheckBox: FC<IRHFTextField> = ({
  name,
  label,
  defaultChecked,
  ...other
}) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        console.log("field", field);
        return (
          <FormControlLabel
            control={
              <Checkbox
                defaultChecked={!!defaultChecked}
                color="primary"
                onChange={(e) => field.onChange(e.target.checked)}
                checked={!!field.value}
              />
            }
            label={label}
          />
        );
      }}
    />
  );
};

export default RHCheckBox;
