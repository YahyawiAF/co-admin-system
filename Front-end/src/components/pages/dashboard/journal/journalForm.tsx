import { FC, useState } from "react";
import * as React from "react";
import {
  Box,
  styled,
  Button,
  Snackbar,
  Divider,
  Typography,
  Card,
  CardContent,
  Grid,
  Alert,
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
  payedAmount: 0,
  registredTime: new Date(),
  leaveTime: new Date(),
  memberID: null,
  priceId: null,
  isReservation: false,
};

const formatDuration = (startDate: Date, endDate: Date): string => {
  const diffInMilliseconds = endDate.getTime() - startDate.getTime();
  const diffInMinutes = Math.floor(diffInMilliseconds / (1000 * 60));
  
  if (diffInMinutes < 0) return "0min";
  
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
  const [tarifAlert, setTarifAlert] = useState<{show: boolean, message: string}>({show: false, message: ''});

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

  const parseTimeToMinutes = (timeStr: string): number => {
    if (!timeStr.includes('h')) return 0;
    
    const [hoursStr, minutesStr] = timeStr.split('h');
    const hours = parseInt(hoursStr) || 0;
    const minutes = parseInt(minutesStr) || 0;
    
    return hours * 60 + minutes;
  };

  const findMatchingPrice = (startDate: Date, endDate: Date): Price | null => {
    if (!pricesList || pricesList.length === 0) return null;
    
    const diffInMinutes = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60));
    
    // Trier les prix par durée croissante
    const sortedPrices = [...pricesList].sort((a, b) => {
      const aStart = parseTimeToMinutes(a.timePeriod.start);
      const bStart = parseTimeToMinutes(b.timePeriod.start);
      return aStart - bStart;
    });

    // Trouver le tarif correspondant avec marge de 15 minutes
    for (let i = 0; i < sortedPrices.length; i++) {
      const price = sortedPrices[i];
      const start = parseTimeToMinutes(price.timePeriod.start);
      let end = parseTimeToMinutes(price.timePeriod.end);
      
      // Ajouter 15 minutes à la limite supérieure sauf pour le dernier tarif
      if (i < sortedPrices.length - 1) {
        end += 15;
      }
      
      if (diffInMinutes >= start && (i === sortedPrices.length - 1 ? diffInMinutes >= end : diffInMinutes < end)) {
        return price;
      }
    }

    return sortedPrices[sortedPrices.length - 1]; // Retourner le dernier tarif par défaut
  };

  React.useEffect(() => {
    if (pricesList && registredTime && leaveTime) {
      const start = new Date(registredTime);
      const end = new Date(leaveTime);
      const matchingPrice = findMatchingPrice(start, end);

      if (matchingPrice) {
        setValue("priceId", matchingPrice.id);
        setValue("payedAmount", isPayed ? matchingPrice.price : 0);
        
        // Calculer le temps restant avant le prochain tarif
        const currentDuration = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
        const priceEnd = parseTimeToMinutes(matchingPrice.timePeriod.end);
        const minutesLeft = priceEnd - currentDuration;
        
        // Afficher une alerte si on approche de la limite
        if (minutesLeft <= 15 && minutesLeft > -15) {
          setTarifAlert({
            show: true,
            message: `Tarif actuel: ${matchingPrice.timePeriod.start}-${matchingPrice.timePeriod.end} (${matchingPrice.price} DT)`
          });
        } else {
          setTarifAlert({show: false, message: ''});
        }
      }
    }
  }, [registredTime, leaveTime, pricesList, setValue, isPayed]);

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

  const handlePriceSelect = (price: Price) => {
    setValue("priceId", price.id);
    setValue("payedAmount", price.price);
    setTarifAlert({show: false, message: ''});
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
            {tarifAlert.show && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {tarifAlert.message}
              </Alert>
            )}
            {!isLoadingPrices ? (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Select Rate
                </Typography>
                <Grid container spacing={2}>
                  {pricesList?.map((price) => (
                    <Grid item xs={6} key={price.id}>
                      <PriceCard
                        price={price}
                        isSelected={priceId === price.id}
                        onClick={() => handlePriceSelect(price)}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
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

const PriceCard: FC<{
  price: Price;
  isSelected: boolean;
  onClick: () => void;
}> = ({ price, isSelected, onClick }) => {
  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        border: isSelected ? '2px solid #054547' : '1px solid #ddd',
        backgroundColor: isSelected ? '#f5f9f9' : '#fff',
        transition: 'all 0.3s ease',
        '&:hover': {
          borderColor: '#054547',
          backgroundColor: '#f5f9f9',
        },
      }}
    >
      <CardContent>
        <Typography variant="subtitle1" fontWeight="bold">
          {price.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {price.timePeriod.start} - {price.timePeriod.end}
        </Typography>
        <Typography variant="h6" sx={{ mt: 1 }}>
          {price.price} DT
        </Typography>
      </CardContent>
    </Card>
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