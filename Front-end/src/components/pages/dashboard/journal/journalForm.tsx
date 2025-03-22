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
import { useForm } from "react-hook-form";
import FormProvider from "../../../hook-form/FormProvider";
import RHFTextField from "../../../hook-form/RHTextField";
import {
  RHFDatePeakerField,
  RHFTimePeakerField,
} from "../../../hook-form/RHTextFieldDate";
import RHCheckBox from "../../../hook-form/RHCheckBox";
import { Journal, Member, Price } from "../../../../types/shared";
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
import { useGetPricesQuery } from "src/api/price.repo";

// ----------------------------------------------------------------------

interface IShopFilterSidebar {
  selectItem: Journal | null;
  handleClose: () => void;
  today: Date;
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
  | "priceId"
>;

type ExtendedTypeOptional = ExtractedType & {};

const defaultValues: Partial<ExtendedTypeOptional> = {
  id: "",
  isPayed: false,
  payedAmount: 4,
  registredTime: new Date(),
  leaveTime: new Date(),
  memberID: null,
  priceId: null,
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
    error: membersError,
  } = useGetMembersQuery();
  const {
    data: pricesList,
    isLoading: isLoadingPrices,
    error: pricesError,
  } = useGetPricesQuery();
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
    priceId: z.string(), // Ajout du champ priceId
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
  const registredTime = watch("registredTime") as Date;
  const isReservation = watch("isReservation");
  const priceId = watch("priceId");

  // Mettre à jour payedAmount lorsque priceId change
  React.useEffect(() => {
    if (priceId && pricesList) {
      const selectedPrice = pricesList.find((price: Price) => price.id === priceId);
      if (selectedPrice) {
        setValue("payedAmount", selectedPrice.price);
      }
    }
  }, [priceId, pricesList, setValue]);

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
            error={!!errors.memberID}
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
            {!isLoadingPrices ? (
              <RHSelectDropDown
                name="priceId"
                list={pricesList}
                label="Select Rate"
                onhandleManuelUpdae={() => console.log("Manual update triggered")}
              />
            ) : (
              <div>Loading Prices...</div>
            )}
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
                    : "8 DT"}
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
                    : "8 DT"}
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