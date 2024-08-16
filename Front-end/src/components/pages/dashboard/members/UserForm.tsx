// components
import { FC, useState } from "react";
import * as React from "react";
import { Box, styled, Button, Snackbar, MenuItem } from "@mui/material";
//Yup
import { useForm } from "react-hook-form";
//Form
import FormProvider from "../../../../components/hook-form/FormProvider";
import RHFTextField from "../../../../components/hook-form/RHTextField";
import RHTextFieldDate from "../../../../components/hook-form/RHTextFieldDate";
import RHSelectDropDown from "../../../../components/hook-form/RHSelectDropDown";

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
  createdOn: null,
  email: "",
  fullName: "",
  birthdate: "",
  price: 0,
  plan: "basic",
  inscriptionDate: "",
};

const ShopFilterSidebar: FC<IShopFilterSidebar> = ({
  handleClose,
  selectItem,
}) => {
  const [createMember, { isLoading }] = useCreateMemberMutation();
  const [updateMember] = useUpdateMemberMutation();

  const [openSnak, setOpenSnak] = useState(false);

  const validationSchema: ZodType<Omit<User, "createdOn">> = z.object({
    email: z.string().email("Email must be a valid email address"),
    fullName: z.string({ required_error: "FullName required" }).min(1),
    birthdate: z.date({ required_error: "birthdate required" }),
    inscriptionDate: z.date({ required_error: "inscription date required" }),
    price: z.number(),
    plan: z.enum(["basic", "user"]),
  });

  const methods = useForm({
    resolver: zodResolver(validationSchema),
    defaultValues,
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
    reset,
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
      updateMember({ ...selectItem, ...data });
      handleClose();
    } else {
      data.createdOn = new Date();
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
        <RHFTextField
          name="price"
          label="Price"
          placeholder="Price"
          type="number"
        />
        <RHTextFieldDate
          name="birthdate"
          label="Birthdate"
          placeholder="Birthdate"
        />
        <RHTextFieldDate
          name="inscriptionDate"
          label="Inscription Date"
          placeholder="Inscription Date"
        />
        <RHSelectDropDown name="plan" label="Plan" list={["basic"]} />
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
