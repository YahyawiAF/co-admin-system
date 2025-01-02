// components
import { FC, useState } from "react";
import * as React from "react";
import { Box, styled, Button, Snackbar } from "@mui/material";
//Yup
import { useForm } from "react-hook-form";
//Form
import FormProvider from "../../../hook-form/FormProvider";
import RHFTextField from "../../../hook-form/RHTextField";
import { RHFTimePeakerField } from "../../../hook-form/RHTextFieldDate";
import RHCheckBox from "../../../hook-form/RHCheckBox";

import { Journal, Member } from "../../../../types/shared";
import { MethodeType } from "../../../../types/hooksForm";
import { LoadingButton } from "@mui/lab";
import { zodResolver } from "@hookform/resolvers/zod";
import { ZodType, z } from "zod";
import {
  useCreateJournalMutation,
  useUpdateJournalMutation,
} from "src/api/journal.repo";
import RHFAutoCompletDropDown from "src/components/hook-form/RHFAutoCompletDropDown";
import { useGetMembersQuery } from "src/api";

// ----------------------------------------------------------------------

interface IShopFilterSidebar {
  selectItem: Journal | null;
  handleClose: () => void;
}

const defaultValues: Partial<Journal> = {
  id: "",
  isPayed: false,
  payedAmount: 0,
  registredTime: new Date(),
  memberID: null,
};

const ShopFilterSidebar: FC<IShopFilterSidebar> = ({
  handleClose,
  selectItem,
}) => {
  // API
  const {
    data: membersList,
    isLoading: isLoadingMember,
    error,
  } = useGetMembersQuery();
  const [createJournal, { isLoading }] = useCreateJournalMutation();
  const [updateMember] = useUpdateJournalMutation();
  // state
  const [openSnak, setOpenSnak] = useState(false);
  const [member, setMember] = useState(undefined);

  let time = new Date().toLocaleTimeString();
  const [ctime, setTime] = useState(time);

  const UpdateTime = () => {
    time = new Date().toLocaleTimeString();
    setTime(time);
  };

  setInterval(UpdateTime);

  const validationSchema: ZodType<Omit<Journal, "createdOn">> = z.object({
    // email: z.union([z.literal(""), z.string().email()]),
    // fullName: z.string({ required_error: "FullName required" }).min(1),
    registredTime: z.union([z.string().optional(), z.date()]),
    isPayed: z.boolean().optional(),
    payedAmount: z.number().optional(),
    memberID: z.string(),
  });

  const methods = useForm({
    resolver: zodResolver(validationSchema),
    defaultValues,
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
    reset,
    setValue,
    watch,
  } = methods;

  const formValues = watch();

  const resetAsyn = React.useCallback(
    (data: any) => {
      reset(data, { keepValues: false });
    },
    [reset]
  );

  React.useEffect(() => {
    if (selectItem) {
      resetAsyn(selectItem);
      resetAsyn(selectItem);
      if (selectItem) {
        setMember(selectItem?.members);
      }
    }
  }, [selectItem, resetAsyn]);

  const handleSelect = (event: any) => {
    console.log("handleSelect", event);
    if (event) {
      setMember(event);
      setValue("memberID", event.id);
    } else {
      setMember(" ");
      setValue("memberID", "");
    }
  };

  const defaultProps = React.useMemo(() => {
    return {
      options: membersList as any,
      getOptionLabel: (option: any) =>
        option.fullNameWithEmail + ` (${option.plan})`,
    };
  }, [membersList]);

  const onSubmit = async (data: Partial<Journal>) => {
    if (selectItem) {
      console.log("data", data);
      updateMember({ ...selectItem, ...data });
      handleClose();
    } else {
      data.createdOn = new Date();
      data.registredTime = data.registredTime ? data.registredTime : new Date();
      if (data.isPayed) data.leaveTime = new Date();
      createJournal(data as Journal);
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
        message={`Journal ${selectItem ? "updated" : "created"} !`}
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
        {!isLoadingMember ? (
          <RHFAutoCompletDropDown
            label="Keywords Tags"
            placeholder="Search for Keywords"
            defaultProps={defaultProps}
            selectedItem={member}
            handleSelection={handleSelect}
            name={"member"}
            multiple={false}
          />
        ) : (
          <div>Loading!!</div>
        )}
        {/* <RHFTextField name="fullName" label="FullName" placeholder="FullName" /> */}
        {/* <RHFTextField name="email" label="Email" placeholder="Email" /> */}
        <RHFTimePeakerField
          name="registredTime"
          label="Starting Date"
          placeholder="Inscription Date"
        />
        <RHCheckBox defaultChecked={false} name="isPayed" label="Payed" />
        <RHFTextField
          type="number"
          name="payedAmount"
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
