// components
import { FC, useState } from "react";
import * as React from "react";
import { Box, styled, Button, Snackbar, MenuItem } from "@mui/material";
//Yup
import { useForm } from "react-hook-form";
//Form
import FormProvider from "../../../../components/hook-form/FormProvider";
import RHFTextField from "../../../../components/hook-form/RHTextField";
import RHSelectDropDown from "../../../../components/hook-form/RHSelectDropDown";

import { Subscription, Member } from "../../../../types/shared";
import { MethodeType } from "../../../../types/hooksForm";
import { LoadingButton } from "@mui/lab";
import { zodResolver } from "@hookform/resolvers/zod";
import { ZodType, z } from "zod";
import { useCreateMemberMutation, useUpdateMemberMutation } from "src/api";
import { parseErrorMessage } from "src/utils/api";

// ----------------------------------------------------------------------

interface IShopFilterSidebar {
  selectItem: Member | null;
  handleClose: () => void;
  setMember: React.Dispatch<React.SetStateAction<Member | null>>;
}

const defaultValues: Partial<Member> = {
  id: "",
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  plan: Subscription.NOPSubs,
};

const ShopFilterSidebar: FC<IShopFilterSidebar> = ({
  handleClose,
  selectItem,
  setMember,
}) => {
  const [
    createMember,
    { isLoading: isLoadingCreateeM, error: errorCreateMember },
  ] = useCreateMemberMutation();
  const [updateMember, { isLoading: isLoadingUpdateM, error: errorUpdateM }] =
    useUpdateMemberMutation();

  const isLoading = React.useMemo(
    () => isLoadingCreateeM || isLoadingUpdateM,
    [isLoadingCreateeM, isLoadingUpdateM]
  );

  const error = React.useMemo(
    () => errorCreateMember || errorUpdateM,
    [errorCreateMember, errorUpdateM]
  );

  const [openSnak, setOpenSnak] = useState(false);

  const validationSchema: ZodType<Omit<Member, "createdOn">> = z.object({
    firstName: z.string({ required_error: "FirstName required" }).min(1),
    phone: z.number({ required_error: "Phone required" }).min(1),
    email: z.union([z.literal(""), z.string().email()]),
    lastName: z.string({ required_error: "LastName required" }).min(1),
    plan: z.enum(["NOPSubs", "Monthly", "Weekly"]),
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

  const onSubmit = async (data: Partial<Member>) => {
    if (selectItem) {
      try {
        await updateMember({ ...selectItem, ...data }).unwrap();
        handleClose();
      } catch (e) {
        console.log("createJournalError", e);
      }
    } else {
      try {
        data.createdOn = new Date();
        if (!data.email) {
          delete data.email;
        }

        await createMember(data as Member)
          .unwrap()
          .then((data) => setMember(data));

        setOpenSnak(true);
        handleClose();
      } catch (e) {
        console.log("createJournalError", e);
      }
    }
  };

  return (
    <>
      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        open={openSnak}
        onClose={handleClose}
        message={`Member ${selectItem ? "updated" : "created"} !`}
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
        <RHFTextField
          name="firstName"
          label="FirstName"
          placeholder="FullName"
        />
        <RHFTextField name="lastName" label="LastName" placeholder="lastName" />
        <RHFTextField
          sx={{
            "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button":
              {
                display: "none",
              },
            "& input[type=number]": {
              MozAppearance: "textfield",
            },
          }}
          type="number"
          name="phone"
          label="Phone"
          placeholder="Phone"
        />
        <RHFTextField name="email" label="Email" placeholder="Email" />
        <RHSelectDropDown
          name="plan"
          label="Plan"
          list={["NOPSubs", "Monthly", "Weekly"]}
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
        {!!error ? (
          <p style={{ color: "red" }}>{parseErrorMessage(error)}</p>
        ) : (
          <></>
        )}
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
