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
import {
  addHours,
  differenceInHours,
  setHours,
  setMinutes,
  isSameDay,
} from "date-fns";
import RHSelectDropDown from "src/components/hook-form/RHSelectDropDown";
import {
  adjustDateWithDifference,
  getHourDifference,
  updateHoursAndMinutes,
} from "src/utils/shared";
// ----------------------------------------------------------------------

interface IShopFilterSidebar {
  selectItem: Journal | null;
  handleClose: () => void;
  today: Date;
}

enum JournalType {
  DEMI_JOURNEE = "DEMI_JOURNEE",
  JOURNEE = "JOURNEE",
}

type ExtractedType = Pick<
  Journal,
  | "id"
  | "isPayed"
  | "payedAmount"
  | "registredTime"
  | "leaveTime"
  | "memberID"
  | "isReservation"
>;

type ExtendedTypeOptional = ExtractedType & {
  journalType: JournalType;
};

const defaultValues: Partial<ExtendedTypeOptional> = {
  id: "",
  isPayed: false,
  payedAmount: 4,
  registredTime: new Date(),
  leaveTime: new Date(),
  memberID: null,
  journalType: JournalType.DEMI_JOURNEE,
  isReservation: false,
};

const ShopFilterSidebar: FC<IShopFilterSidebar> = ({
  handleClose,
  selectItem,
  today,
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
  const [isManualyUpdating, setIsManualyUpdating] = useState(false);
  const [isManualyCalculationUpdating, setIsManualyCalculationUpdating] =
    useState(false);

  const validationSchema: ZodType<Omit<Journal, "createdOn">> = z.object({
    registredTime: z.union([z.string().optional(), z.date()]),
    leaveTime: z.union([z.string().optional(), z.date().optional()]),
    isPayed: z.boolean().optional(),
    payedAmount: z.number().optional(),
    memberID: z.string(),
    journalType: z
      .enum([JournalType.DEMI_JOURNEE, JournalType.JOURNEE])
      .optional(),
    isReservation: z.boolean(),
  });

  const methods = useForm({
    resolver: zodResolver(validationSchema),
    defaultValues,
  });

  const {
    handleSubmit,
    formState: { isSubmitting, errors },
    reset,
    setValue,
    watch,
  } = methods;

  const isPayed = watch("isPayed");
  const leaveTime = watch("leaveTime");
  const payedAmount = watch("payedAmount");
  const journalType = watch("journalType");
  const registredTime = watch("registredTime") as Date;
  const isReservation = watch("isReservation");

  // console.log("isReservation", isReservation);

  const stayedHours = React.useMemo(() => {
    const dStarting = registredTime ? new Date(registredTime) : new Date();
    const dLeaving = leaveTime ? new Date(leaveTime) : new Date();
    return differenceInHours(dLeaving, dStarting);
  }, [registredTime, leaveTime]);

  const resetAsyn = React.useCallback(
    (data: any) => {
      reset(data, { keepValues: false });
    },
    [reset]
  );

  React.useEffect(() => {
    const initializeFormValues = () => {
      const isReservation = !isSameDay(new Date(), new Date(today));
      if (!selectItem) {
        resetAsyn({
          ...defaultValues,
          registredTime: updateHoursAndMinutes(today),
          leaveTime: updateHoursAndMinutes(today),
          isReservation,
        });
      } else {
        const updatedJournal: Partial<Journal> = {
          ...selectItem,
          leaveTime: selectItem.isPayed
            ? selectItem.leaveTime
            : updateHoursAndMinutes(today),
        };
        resetAsyn(updatedJournal);
        setMember(selectItem?.members ?? null);
      }
    };
    initializeFormValues();
  }, [selectItem, resetAsyn, today]);

  // React.useEffect(() => {
  //   if (!isPayed) {
  //     setValue("payedAmount", 0);
  //     return;
  //   }
  // }, [isPayed, setValue]);

  React.useEffect(() => {
    const adjustLeaveTime = async () => {
      if (!isManualyUpdating) return;
      if (!registredTime || !journalType) return;

      const baseDate = new Date(registredTime);
      const updatedLeaveTime =
        journalType === JournalType.JOURNEE
          ? addHours(baseDate, 8)
          : addHours(baseDate, 6);

      const updatedPrice = journalType === JournalType.DEMI_JOURNEE ? 4 : 8;
      if (
        leaveTime &&
        new Date(leaveTime).getTime() === updatedLeaveTime.getTime()
      ) {
        return;
      }

      setValue("payedAmount", updatedPrice);
      setValue("leaveTime", updatedLeaveTime);
      setIsManualyUpdating(false);
    };

    adjustLeaveTime();
  }, [registredTime, setValue, journalType, leaveTime, isManualyUpdating]);

  React.useEffect(() => {
    const adjustJournalType = () => {
      if (!isManualyCalculationUpdating) return;
      if (!registredTime || !journalType) return;
      let hoursDifference = 0;
      if (leaveTime) {
        hoursDifference = getHourDifference(registredTime, leaveTime);
      }
      const updatedJournal =
        hoursDifference <= 6 ? JournalType.DEMI_JOURNEE : JournalType.JOURNEE;
      const updatedPrice = updatedJournal === JournalType.DEMI_JOURNEE ? 4 : 8;
      if (journalType && journalType === updatedJournal) {
        return;
      }
      setValue("payedAmount", updatedPrice);
      setValue("journalType", updatedJournal);
      setIsManualyCalculationUpdating(false);
    };

    adjustJournalType();
  }, [
    registredTime,
    setValue,
    journalType,
    leaveTime,
    isManualyCalculationUpdating,
  ]);

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
        await createJournal(data as Journal).unwrap();
        setOpenSnak(true);
        handleClose();
      } catch (e) {
        console.log("createJournalError", e);
      }
    }
  };

  const handleNewMember = (member: Member) => {
    setMember(member);
    setValue("memberID", member.id);
  };

  if (openUserForm)
    return (
      <UserForm
        handleClose={() => {
          setOpenUserForm(false);
        }}
        selectItem={null}
        handleNewMember={handleNewMember}
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
            disabled={!!selectItem}
            multiple={false}
            error={!!!errors.memberID}
            errorMessage={errors.memberID?.message}
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
            </Box>
            <RHCheckBox defaultChecked={false} name="isPayed" label="Payed" />
          </>
        ) : (
          <></>
        )}
        {isPayed && member ? (
          <>
            <RHSelectDropDown
              name="journalType"
              list={["DEMI_JOURNEE", "JOURNEE"]}
              onhandleManuelUpdae={() => setIsManualyUpdating(true)}
            />
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                rowGap: "14px",
              }}
            >
              <RHFDatePeakerField
                name="leaveTime"
                label="Leaving Date"
                placeholder="Leaving Date"
                minTime={registredTime}
              />
              {!isReservation && (
                <Button
                  onClick={() => {
                    setIsManualyCalculationUpdating(true);
                    setValue("leaveTime", new Date());
                  }}
                  variant="outlined"
                >
                  Calculate from Now
                </Button>
              )}
            </Box>
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
                    ? payedAmount + " DT"
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
                    ? payedAmount + " DT"
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
