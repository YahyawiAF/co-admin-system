// components
import { FC, useState } from "react";
import * as React from "react";
import {
  Box,
  styled,
  Button,
  Snackbar,
  Divider,
  Typography,
} from "@mui/material";
//Yup
import { useForm } from "react-hook-form";
//Form
import FormProvider from "../../../hook-form/FormProvider";
import RHFTextField from "../../../hook-form/RHTextField";
import {
  RHFDatePeakerField,
  RHFTimePeakerField,
} from "../../../hook-form/RHTextFieldDate";
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
import { parseErrorMessage } from "src/utils/api";
import { PersonAdd } from "@mui/icons-material";
import UserForm from "../members/UserForm";
import { addHours, differenceInHours } from "date-fns";
import RHSelectDropDown from "src/components/hook-form/RHSelectDropDown";
import { date } from "yup";
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
  leaveTime: new Date(),
  memberID: null,
  daySubscriptionType: "DemiJournée",
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
  const [createJournal, { isLoading, error: createJournalError }] =
    useCreateJournalMutation();
  const [updateMember] = useUpdateJournalMutation();
  // state
  const [openSnak, setOpenSnak] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [openUserForm, setOpenUserForm] = useState(false);

  const validationSchema: ZodType<Omit<Journal, "createdOn">> = z.object({
    registredTime: z.union([z.string().optional(), z.date()]),
    leaveTime: z.union([z.string().optional(), z.date().optional()]),
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

  const onSetDefaultValues = () => {};

  const isPayed = watch("isPayed");
  const leaveTime = watch("leaveTime");
  const payedAmount = watch("payedAmount");
  const daySubscriptionType = watch("daySubscriptionType");
  const registredTime = watch("registredTime");

  const stayedHours = React.useMemo(() => {
    const dStarting = selectItem?.registredTime
      ? new Date(selectItem?.registredTime)
      : new Date();
    const dLeaving = leaveTime ? new Date(leaveTime) : new Date();
    return differenceInHours(dLeaving, dStarting);
  }, [selectItem, leaveTime]);

  const resetAsyn = React.useCallback(
    (data: any) => {
      reset(data, { keepValues: false });
    },
    [reset]
  );

  React.useEffect(() => {
    if (selectItem) {
      let updatedMemberJournal = { ...selectItem };
      if (!updatedMemberJournal.isPayed)
        updatedMemberJournal.leaveTime = new Date();
      if (!updatedMemberJournal.daySubscriptionType)
        updatedMemberJournal.daySubscriptionType = "DemiJournée";
      resetAsyn(updatedMemberJournal);
      if (selectItem) {
        setMember(selectItem?.members);
      }
    }
  }, [selectItem, resetAsyn]);

  React.useEffect(() => {
    if (isPayed) {
      if (member?.plan === "NOPSubs") {
        if (stayedHours > 6) {
          setValue("payedAmount", 8);
        } else {
          setValue("payedAmount", 4);
        }
      }
    } else {
      setValue("payedAmount", 0);
    }
  }, [isPayed, setValue, stayedHours, member]);

  React.useEffect(() => {
    let date = registredTime ? new Date(registredTime) : new Date();
    if (daySubscriptionType === "Journée") {
      const newDate = addHours(date, 8);
      setValue("leaveTime", newDate);
    } else if (daySubscriptionType === "DemiJournée") {
      const newDate = addHours(date, 6);
      setValue("leaveTime", newDate);
    }
  }, [registredTime, setValue, daySubscriptionType]);

  const handleSelect = (event: any) => {
    if (event) {
      setMember(event);
      setValue("memberID", event.id);
    } else {
      setMember(null);
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
      updateMember({ ...selectItem, ...data });
      handleClose();
    } else {
      try {
        data.registredTime = data.registredTime
          ? data.registredTime
          : new Date();
        if (data.isPayed && !data.leaveTime) data.leaveTime = new Date();
        await createJournal(data as Journal).unwrap();
        setOpenSnak(true);
        handleClose();
      } catch (e) {
        console.log("createJournalError", e);
      }
    }
  };

  if (openUserForm)
    return (
      <UserForm
        handleClose={() => {
          setOpenUserForm(false);
        }}
        selectItem={null}
        setMember={setMember}
      />
    );

  return (
    <>
      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        open={openSnak}
        onClose={handleClose}
        message={`Journal ${selectItem ? "updated" : "created"} !`}
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
        {!selectItem ? (
          <Box
            style={{
              padding: 0,
              display: "flex",
              gap: "10px",
            }}
          >
            <ActionButtton
              endIcon={<PersonAdd />}
              autoFocus
              onClick={() => setOpenUserForm(true)}
            >
              New Member
            </ActionButtton>
          </Box>
        ) : (
          <></>
        )}
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
        {member ? (
          <>
            <Box
              sx={{
                display: "flex",
                columnGap: "14px",
              }}
            >
              <RHFTimePeakerField
                name="registredTime"
                label="Starting Date"
                placeholder="Inscription Date"
              />
              <Button
                onClick={() => setValue("registredTime", new Date())}
                variant="outlined"
              >
                Now
              </Button>
            </Box>
            <RHCheckBox defaultChecked={false} name="isPayed" label="Payed" />
          </>
        ) : (
          <></>
        )}
        {isPayed && member ? (
          <>
            <RHSelectDropDown
              name="daySubscriptionType"
              list={["Journée", "DemiJournée"]}
            />
            <RHFDatePeakerField
              name="leaveTime"
              label="Leaving Date"
              placeholder="Leaving Date"
            />
            <RHFTextField
              type="number"
              name="payedAmount"
              label="Price Payed (DT)"
              placeholder="Prix"
            />
            <Divider />
            <Box
              style={{
                flexDirection: "column",
                padding: 0,
                display: "flex",
                gap: "10px",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  justifyItems: "center",
                }}
              >
                <Typography variant="subtitle2">Stayed Hours</Typography>
                <Typography sx={{ fontWeight: "Bold" }} variant="body1">
                  {stayedHours + " hours"}
                </Typography>
              </Box>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  justifyItems: "center",
                }}
              >
                <Typography variant="subtitle2">Total</Typography>
                <Typography sx={{ fontWeight: "Bold" }} variant="body1">
                  {payedAmount
                    ? payedAmount
                    : stayedHours < 1
                    ? "0 DT"
                    : stayedHours <= 6
                    ? "4 DT"
                    : "8DT"}
                </Typography>
              </Box>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  justifyItems: "center",
                }}
              >
                <Typography variant="subtitle2">Discount</Typography>
                <Typography sx={{ fontWeight: "Bold" }} variant="body1">
                  {"0 DT"}
                </Typography>
              </Box>
              <Divider />
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  justifyItems: "center",
                }}
              >
                <Typography variant="h4">SubTotal</Typography>
                <Typography sx={{ fontWeight: "Bold" }} variant="subtitle1">
                  {payedAmount
                    ? payedAmount
                    : stayedHours < 1
                    ? "0 DT"
                    : stayedHours <= 6
                    ? "4 DT"
                    : "8DT"}
                </Typography>
              </Box>
              <Divider />
            </Box>
          </>
        ) : (
          <></>
        )}

        <Box
          style={{
            padding: 0,
            display: "flex",
            gap: "10px",
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

        {!!createJournalError ? (
          <p style={{ color: "red" }}>
            {parseErrorMessage(createJournalError)}
          </p>
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
