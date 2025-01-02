import { FC } from "react";
import { useFormContext, Controller } from "react-hook-form";
import {
  TextFieldProps,
  MenuItem,
  FormControl,
  FormHelperText,
} from "@mui/material";
import Select from "@mui/material/Select";
import { styled } from "@mui/system";

type IRHFTextField = {
  name: string;
  list?: any;
  label?: string;
} & TextFieldProps;

const RHSelectDropDown: FC<IRHFTextField> = ({
  name,
  list,
  label,
  ...other
}) => {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        return (
          <StyledDropDown fullWidth>
            <Select
              {...field}
              value={field.value || ""}
              onChange={(e) => field.onChange(e.target.value)}
              defaultValue={list[0]}
              // helperText={error?.message}
              error={!!error}
            >
              {list.map((v: string, index: number) => (
                <MenuItem key={index} value={v}>
                  {v}
                </MenuItem>
              ))}
            </Select>
            {!!error && <FormHelperText>{error?.message}</FormHelperText>}
          </StyledDropDown>
        );
      }}
    />
  );
};

const StyledDropDown = styled(FormControl)(() => ({
  width: "100%",
  ["#mui-component-select-role"]: {
    padding: "7.5px 14px",
  },
}));

export default RHSelectDropDown;
