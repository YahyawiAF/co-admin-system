// components
import { FC, useState } from "react";
import * as React from "react";
import { Box, styled, Button, Snackbar, MenuItem } from "@mui/material";
//Yup
import { useForm } from "react-hook-form";
//Form
import FormProvider from "../../../hook-form/FormProvider";
import RHFTextField from "../../../hook-form/RHTextField";
import { RHFTimePeakerField } from "../../../hook-form/RHTextFieldDate";
import RHCheckBox from "../../../hook-form/RHCheckBox";

import { User } from "../../../../types/shared";
import { MethodeType } from "../../../../types/hooksForm";
import { LoadingButton } from "@mui/lab";
import { zodResolver } from "@hookform/resolvers/zod";
import { ZodType, z } from "zod";
import { useCreateMemberMutation, useUpdateMemberMutation } from "src/api";

// ----------------------------------------------------------------------

interface IShopFilterSidebar {
  selectItem: User | null;
  handleClose: () => void;
}

const defaultValues: User = {
  id: "",
  createdOn: new Date(),
  email: "",
  fullName: "",
  birthdate: "",
  price: 0,
  plan: "basic",
  starting: "",
  payed: false,
};

const ShopFilterSidebar: FC<IShopFilterSidebar> = ({
  handleClose,
  selectItem,
}) => {
  const [createMember, { isLoading }] = useCreateMemberMutation();
  const [updateMember] = useUpdateMemberMutation();

  const [openSnak, setOpenSnak] = useState(false);
  let time = new Date().toLocaleTimeString();

  const [ctime, setTime] = useState(time);
  const UpdateTime = () => {
    time = new Date().toLocaleTimeString();
    setTime(time);
  };
  setInterval(UpdateTime);

  const validationSchema: ZodType<Omit<User, "createdOn">> = z.object({
    email: z.union([z.literal(""), z.string().email()]),
    fullName: z.string({ required_error: "FullName required" }).min(1),
    starting: z.union([z.string().optional(), z.date()]),
    payed: z.boolean().optional(),
    price: z.number().optional(),
  });

  const methods = useForm({
    resolver: zodResolver(validationSchema),
    defaultValues,
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
    reset,
    control,
  } = methods;

  const resetAsyn = React.useCallback(
    (data: any) => {
      reset(data, { keepValues: false });
    },
    [reset]
  );

  React.useEffect(() => {
    if (selectItem) {
      resetAsyn(selectItem);
    }
  }, [selectItem, resetAsyn]);

  const onSubmit = async (data: User) => {
    if (selectItem) {
      console.log("data", data);
      updateMember({ ...selectItem, ...data });
      handleClose();
    } else {
      console.log("data creat", data);
      data.createdOn = new Date();
      data.starting = data.starting ? data.starting : new Date().toDateString();

      createMember(data as User);
      setOpenSnak(true);
      handleClose();
    }
  };

  return (
    <>
      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        open={openSnak}
        onClose={handleClose}
        message={`User ${selectItem ? "updated" : "created"} !`}
        key={"bottom" + "right"}
      />
      <h1>{ctime}</h1>
      <FormProvider
        styles={{
          width: "100%",
          height: "100%",
          gap: "25px",
          display: "flex",
          flexDirection: "column",
        }}
        methods={methods as unknown as MethodeType}
        onSubmit={handleSubmit(onSubmit)}
      >
        <RHFTextField name="fullName" label="FullName" placeholder="FullName" />
        <RHFTextField name="email" label="Email" placeholder="Email" />
        <RHFTimePeakerField
          name="starting"
          label="Starting Date"
          placeholder="Inscription Date"
        />
        <RHCheckBox defaultChecked={false} name="payed" label="Payed" />
        <RHFTextField
          type="number"
          name="price"
          label="Price Payed (DT)"
          placeholder="Prix"
        />
        <Box
          style={{
            padding: 0,
            display: "flex",
            gap: "10px",
            marginTop: "25px",
          }}
        >
          <ActionButtton autoFocus onClick={handleClose}>
            Cancel
          </ActionButtton>
          <SubmitButtton
            type="submit"
            disabled={isSubmitting || isLoading}
            style={{ marginLeft: 0 }}
            autoFocus
          >
            Confirm
          </SubmitButtton>
        </Box>
      </FormProvider>
    </>
  );
};

const SubmitButtton = styled(LoadingButton)(() => ({
  border: "1px solid",
  borderColor: "#054547",
  background: "#fff",
  color: "#054547",
  width: "50%",
  height: "50px",
  lineHeight: "50px",
  cursor: "pointer",
  borderRadius: 0,
  margin: 0,
  "&:hover": {
    background: "#054547",
    color: "#fff",
  },
}));

const ActionButtton = styled(Button)(() => ({
  border: "1px solid",
  borderColor: "#054547",
  background: "#fff",
  color: "#054547",
  width: "50%",
  height: "50px",
  lineHeight: "50px",
  cursor: "pointer",
  borderRadius: 0,
  margin: 0,
  "&:hover": {
    background: "#054547",
    color: "#fff",
  },
}));
export default ShopFilterSidebar;
