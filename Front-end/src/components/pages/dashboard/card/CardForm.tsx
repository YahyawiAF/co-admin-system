// components
import { FC } from "react";
import * as React from "react";
import {
  Box,
  styled,
  Button,
  Card as MuiCard,
  CardContent,
  Grid,
} from "@mui/material";
//Yup
import { useForm } from "react-hook-form";
//Form
import FormProvider from "../../../../components/hook-form/FormProvider";
import RHFTextField from "../../../../components/hook-form/RHTextField";
import { spacing } from "@mui/system";

import { Card as ICARD, User } from "../../../../types/shared";
import { MethodeType } from "../../../../types/hooksForm";
import { LoadingButton } from "@mui/lab";
import { zodResolver } from "@hookform/resolvers/zod";
import { ZodType, z } from "zod";
import RHRadioButton from "src/components/hook-form/RHRadioButton";
import RHTextFieldDate from "src/components/hook-form/RHTextFieldDate";
import { useCreateCardMutation, useUpdateCardMutation } from "src/api";

const Card = styled(MuiCard)(spacing);
// ----------------------------------------------------------------------

interface IShopFilterSidebar {
  selectItem: any;
  handleClose: () => void;
}

const defaultValues = {
  isPhysical: "0",
  lockCard: "0",
};

const ShopFilterSidebar: FC<IShopFilterSidebar> = ({
  handleClose,
  selectItem,
}) => {
  const [createCard] = useCreateCardMutation();
  const [updateCard] = useUpdateCardMutation();

  const validationSchema: ZodType<Omit<ICARD, "createdOn">> = z.object({
    isPhysical: z.string(),
    expiry: z.string(),
    lockCard: z.nullable(z.string()),
    name: z.string(),
    cardNumberHidden: z.number(),
    limits: z.object({
      type: z.string(),
      total: z.number(),
    }),
    address: z.string(),
    comment: z.string(),
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
      reset(data);
    },
    [reset]
  );

  React.useEffect(() => {
    if (selectItem) {
      const resetData = {
        ...selectItem,
        isPhysical: selectItem.isPhysical ? "1" : "0",
        lockCard: selectItem.lockCard ? "1" : "0",
      };
      resetAsyn(resetData);
    }
  }, [selectItem, resetAsyn, reset]);

  const onSubmit = async (data: any) => {
    if (selectItem) {
      const card = {
        ...selectItem,
        ...data,
        isPhysical: data.isPhysical === "1" ? true : false,
        lockCard: data.lockCard === "1" ? true : false,
      };
      updateCard(card);
      handleClose();
    } else {
      // create
      const card = {
        ...data,
        isPhysical: data.isPhysical === "1" ? true : false,
        lockCard: data.lockCard === "1" ? true : false,
      };
      createCard(card);
      handleClose();
    }
  };

  return (
    <>
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
        <Grid container spacing={6}>
          <Grid item md={12}>
            <RHFTextField
              name="name"
              label="Name"
              variant="outlined"
              fullWidth
            />
          </Grid>
        </Grid>
        <Grid container spacing={6}>
          <Grid item md={4}>
            <RHFTextField
              name="cardNumberHidden"
              label="Card Number Hidden"
              variant="outlined"
              type="number"
              InputProps={{
                inputProps: {
                  max: 9999,
                  min: 1000,
                },
              }}
              fullWidth
            />
          </Grid>
          <Grid item md={4}>
            <RHFTextField
              name="limits.type"
              label="Type"
              variant="outlined"
              fullWidth
            />
          </Grid>
          <Grid item md={4}>
            <RHFTextField
              name="limits.total"
              label="Total"
              variant="outlined"
              type="number"
              InputProps={{
                inputProps: {
                  min: 0,
                },
              }}
              fullWidth
            />
          </Grid>
        </Grid>
        <Grid container spacing={6}>
          <Grid item md={12}>
            <RHFTextField
              name="comment"
              label="comment"
              variant="outlined"
              fullWidth
            />
          </Grid>
          <Grid item md={12}>
            <RHFTextField
              name="address"
              label="Address"
              variant="outlined"
              fullWidth
            />
          </Grid>
        </Grid>
        <Grid container spacing={6}>
          <Grid item md={6}>
            <RHTextFieldDate
              name="expiry"
              label="Expiry"
              placeholder="Expiry"
              isMin
              fullWidth
            />
          </Grid>
        </Grid>
        <Grid container spacing={6}>
          <Grid item md={6}>
            <RHRadioButton
              label1="Yes"
              label2="No"
              name={"isPhysical"}
              label={"Physical"}
            />
          </Grid>
          <Grid item md={6}>
            <RHRadioButton
              label1="Yes"
              label2="No"
              name="lockCard"
              label="LockCard"
            />
          </Grid>
        </Grid>

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
            disabled={isSubmitting}
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
