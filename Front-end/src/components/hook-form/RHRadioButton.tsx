import { FC } from "react";
import { useFormContext, Controller } from "react-hook-form";
import {
  FormControlLabelProps,
  FormGroup,
  Radio,
  Typography,
  FormControlLabel,
  FormControl,
  FormLabel,
  RadioGroup,
} from "@mui/material";

type IRHFTextField = {
  name: string;
  label: string;
  label1: string;
  label2: string;
};

const RHRadioButton: FC<IRHFTextField> = ({
  name,
  label1,
  label2,
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
          <FormControl
            sx={{
              flexDirection: "column",
              alignItems: "start",
              flexWrap: "wrap",
            }}
          >
            <Typography
              sx={{
                fontSize: "17px",
                padding: 0,
                fontFamily: "proxima_nova_rgregular",
                marginBottom: "5px",
              }}
              id="demo-controlled-radio-buttons-group"
            >
              {label}
            </Typography>
            <RadioGroup
              {...field}
              value={field.value ? field.value?.toString() : "0"}
              onChange={(event) => {
                field.onChange(event?.target.value);
              }}
              aria-labelledby="demo-controlled-radio-buttons-group"
              name="controlled-radio-buttons-group"
              sx={{
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <FormControlLabel
                value={"1"}
                control={<Radio />}
                label={label1}
              />
              <FormControlLabel
                value={"0"}
                control={<Radio />}
                label={label2}
              />
            </RadioGroup>
          </FormControl>
        );
      }}
    />
  );
};

export default RHRadioButton;
