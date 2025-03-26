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
import { isSameDay } from "date-fns";
import RHSelectRate from "src/components/hook-form/RHSelectRate";
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

// Fonction pour formater la durée en "1h35" ou "45min"
const formatDuration = (startDate: Date, endDate: Date): string => {
  const diffInMilliseconds = endDate.getTime() - startDate.getTime();
  const diffInMinutes = Math.floor(diffInMilliseconds / (1000 * 60));
  
  if (diffInMinutes < 0) return "0min"; // Cas où endDate est avant startDate
  
  const hours = Math.floor(diffInMinutes / 60);
  const minutes = diffInMinutes % 60;
  
  if (hours > 0 && minutes > 0) {
    return `${hours}h${minutes.toString().padStart(2, '0')}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}min`;
  }
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

  const validationSchema: ZodType<Omit<Journal, "createdOn">> = z.object({
    registredTime: z.union([z.string().optional(), z.date()]),
    leaveTime: z.union([z.string().optional(), z.date().optional()]),
    isPayed: z.boolean().optional(),
    payedAmount: z.number().optional(),
    memberID: z.string(),
    priceId: z.string(),
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

  // Helper pour convertir le format "1h" ou "1h30" en minutes
  const parseTimeToMinutes = (timeStr: string): number => {
    if (!timeStr.includes('h')) return 0;
    
    const [hoursStr, minutesStr] = timeStr.split('h');
    const hours = parseInt(hoursStr) || 0;
    const minutes = parseInt(minutesStr) || 0;
    
    return hours * 60 + minutes;
  };
  

  // Fonction pour trouver le tarif correspondant à la durée
  const findMatchingPrice = (startDate: Date, endDate: Date): Price | null => {
    if (!pricesList || pricesList.length === 0) return null;
    
    const diffInMinutes = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60));
    
    // Trier les prix par durée croissante
    const sortedPrices = [...pricesList].sort((a, b) => {
      const aStart = parseTimeToMinutes(a.timePeriod.start);
      const bStart = parseTimeToMinutes(b.timePeriod.start);
      return aStart - bStart;
    });

    // Trouver le tarif correspondant
    for (const price of sortedPrices) {
      const start = parseTimeToMinutes(price.timePeriod.start);
      const end = parseTimeToMinutes(price.timePeriod.end);
      
      if (diffInMinutes >= start && diffInMinutes < end) {
        return price;
      }
    }

    // Si aucun tarif ne correspond exactement, retourner le plus proche
    return sortedPrices.reduce((prev, curr) => {
      const prevDiff = Math.abs(parseTimeToMinutes(prev.timePeriod.start) - diffInMinutes);
      const currDiff = Math.abs(parseTimeToMinutes(curr.timePeriod.start) - diffInMinutes);
      return prevDiff < currDiff ? prev : curr;
    });
  };

  // Mettre à jour le tarif automatiquement quand la durée change
  React.useEffect(() => {
    if (isPayed && pricesList && registredTime && leaveTime) {
      const start = new Date(registredTime);
      const end = new Date(leaveTime);
      const matchingPrice = findMatchingPrice(start, end);
      
      if (matchingPrice) {
        setValue("priceId", matchingPrice.id);
        setValue("payedAmount", matchingPrice.price);
      }
    }
  }, [registredTime, leaveTime, isPayed, pricesList, setValue]);

  // Calculer la durée de séjour formatée
  const stayedDuration = React.useMemo(() => {
    const dStarting = registredTime ? new Date(registredTime) : new Date();
    const dLeaving = leaveTime ? new Date(leaveTime) : new Date();
    return formatDuration(dStarting, dLeaving);
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
          registredTime: today,
          leaveTime: today,
          isReservation,
        });
      } else {
        const updatedJournal: Partial<Journal> = {
          ...selectItem,
          leaveTime: selectItem.isPayed
            ? selectItem.leaveTime
            : today,
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
      // Même implémentation que dans l'ancienne version
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
              <RHSelectRate
                name="priceId"
                list={pricesList}
                label="Select Rate"
                onhandleManuelUpdae={() => {
                  // Permettre la modification manuelle sans réinitialisation automatique
                }}
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
                <Typography variant="subtitle2">Stayed Duration </Typography>
                <Typography sx={{ fontWeight: "Bold" }} variant="body1">
                  {stayedDuration} 
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
                  {payedAmount} DT
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
                  {payedAmount} DT
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