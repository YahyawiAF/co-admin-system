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
  FormControlLabel,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { useForm } from "react-hook-form";
import FormProvider from "../../../hook-form/FormProvider";
import RHFTextField from "../../../hook-form/RHTextField";
import {
  RHFDatePeakerField,
  RHFTimePeakerField,
} from "../../../hook-form/RHTextFieldDate";
import RHCheckBox from "../../../hook-form/RHCheckBox";
import { Journal, Member, Price, Subscription } from "../../../../types/shared";
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
import { addHours, isSameDay } from "date-fns";
import { useGetPricesQuery } from "src/api/price.repo";
import { updateHoursAndMinutes } from "src/utils/shared";
import Fuse from "fuse.js";

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
// Configuration de Fuse.js pour la recherche des membres
const memberSearchOptions = {
  keys: [
    { name: "fullName", weight: 0.5 },
    { name: "email", weight: 0.3 },
    { name: "phone", weight: 0.2 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
  shouldSort: true,
};

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
    return `${hours}h${minutes.toString().padStart(2, "0")}m`;
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
  const [tarifAlert, setTarifAlert] = useState<{
    show: boolean;
    message: string;
  }>({ show: false, message: "" });

  const [isManualyUpdating, setIsManualyUpdating] = useState(false);
  const fuzzySearchMembers = (members: Member[], searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) return members;

    const fuse = new Fuse(members, memberSearchOptions);
    const results = fuse.search(searchTerm);
    return results.map((result) => result.item);
  };
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

  const createdByID = sessionStorage.getItem("userID");

  // Filtrer les prix pour n'afficher que ceux de type "journal"
  const journalPrices = React.useMemo(() => {
    return pricesList?.filter((price) => price.type === "journal") || [];
  }, [pricesList]);

  const parseTimeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;

    // Gérer les formats "1h", "1h30", "2h00", etc.
    const [hoursStr, minutesStr] = timeStr.split("h");
    const hours = parseInt(hoursStr) || 0;
    const minutes = parseInt(minutesStr) || 0;

    return hours * 60 + minutes;
  };
  const findMatchingPrice = React.useCallback(
    (startDate: Date, endDate: Date): Price | null => {
      if (!journalPrices || journalPrices.length === 0) return null;

      const realDurationMinutes = Math.floor(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60)
      );

      // Trier les prix par durée maximale croissante
      const sortedPrices = [...journalPrices].sort((a, b) => {
        const aMax = parseTimeToMinutes(a.timePeriod.end);
        const bMax = parseTimeToMinutes(b.timePeriod.end);
        return aMax - bMax;
      });

      // Variable pour stocker le tarif correspondant
      let matchingPrice = null;

      for (const price of sortedPrices) {
        const priceMax = parseTimeToMinutes(price.timePeriod.end);

        // On considère le tarif valable si la durée est inférieure ou égale à sa limite +15min
        if (realDurationMinutes <= priceMax + 15) {
          matchingPrice = price;
          break; // On prend le premier tarif qui correspond
        }
      }

      // Si aucun tarif ne correspond (durée très longue), retourner le tarif maximum
      return matchingPrice || sortedPrices[sortedPrices.length - 1];
    },
    [journalPrices]
  );

  const handleCalculateTimeAndPrice = React.useCallback(
    (registredTime: Date, leaveTime: Date) => {
      const start = new Date(registredTime);
      const end = new Date(leaveTime);
      const matchingPrice = findMatchingPrice(start, end);

      if (matchingPrice) {
        setValue("priceId", matchingPrice.id);
        setValue("payedAmount", matchingPrice.price);
        // const baseDate = new Date(registredTime);
        // setValue(
        //   "leaveTime",
        //   addHours(baseDate, Number(matchingPrice.timePeriod.end))
        // );
        // Mettre à jour payedAmount avec le prix correspondant, indépendamment de isPayed
        const priceMaxDuration = parseTimeToMinutes(
          matchingPrice.timePeriod.end
        );
        const realDurationMinutes = Math.floor(
          (end.getTime() - start.getTime()) / (1000 * 60)
        );

        if (realDurationMinutes > priceMaxDuration) {
          const nextPrice = journalPrices.find(
            (p) => parseTimeToMinutes(p.timePeriod.start) > priceMaxDuration
          );
          if (nextPrice) {
            setTarifAlert({
              show: true,
              message: `Dépassement de tarif: ${
                realDurationMinutes - priceMaxDuration
              } min (tolérance). Prochain tarif: ${
                nextPrice.timePeriod.start
              }-${nextPrice.timePeriod.end}`,
            });
          }
        } else {
          setTarifAlert({ show: false, message: "" });
        }
      }
    },
    [journalPrices, findMatchingPrice, setValue]
  );

  React.useEffect(() => {
    if (journalPrices && registredTime && leaveTime && !isPayed) {
      handleCalculateTimeAndPrice(registredTime, leaveTime);
    }
  }, [
    registredTime,
    leaveTime,
    journalPrices,
    setValue,
    handleCalculateTimeAndPrice,
    isPayed,
  ]);

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
      if (!selectItem) {
        resetAsyn({
          ...defaultValues,
          registredTime: updateHoursAndMinutes(today),
          leaveTime: updateHoursAndMinutes(today),
        });
      } else {
        // Conserver la logique existante pour l'édition
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

  const handlePriceSelect = (price: Price) => {
    setValue("priceId", price.id);
    setValue("payedAmount", price.price);
    setValue(
      "leaveTime",
      addHours(new Date(registredTime), Number(price.timePeriod.end))
    );
    setTarifAlert({ show: false, message: "" });
  };
  const defaultProps = React.useMemo(() => {
    return {
      options: membersList || [],
      getOptionLabel: (option: Member) =>
        option.fullNameWithEmail + ` (${option.plan})`,
      filterOptions: (
        options: Member[],
        { inputValue }: { inputValue: string }
      ) => {
        if (!inputValue || inputValue.length < 2) return options;
        return fuzzySearchMembers(options, inputValue);
      },
    };
  }, [membersList]);

  const onSubmit = async (data: Partial<Journal>) => {
    if (selectItem) {
      updateMember({ ...selectItem, ...data });
      handleClose();
    } else {
      try {
        await createJournal({
          ...data,
          createdbyUserID: createdByID,
        } as Journal).unwrap();
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
        defaultPlan={Subscription.Journal}
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
            defaultProps={{
              options: membersList || [],
              getOptionLabel: (option: Member) =>
                option.fullNameWithEmail + ` (${option.plan})`,
              filterOptions: (
                options: Member[],
                { inputValue }: { inputValue: string }
              ) => {
                if (!inputValue || inputValue.length < 2) return options;
                return fuzzySearchMembers(options, inputValue);
              },
            }}
            selectedItem={member}
            handleSelection={handleSelect}
            name={"member"}
            disabled={!!selectItem}
            multiple={false}
            error={!!errors.memberID}
            errorMessage={errors.memberID?.message}
            helperText="Tapez au moins 2 caractères pour rechercher un membre"
          />
        ) : (
          <div>Loading!!</div>
        )}
        {member ? (
          <>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                rowGap: "14px",
              }}
            >
              <RHFDatePeakerField
                name="registredTime"
                label="Starting Date"
                placeholder="Starting Date"
                disabled={isPayed}
                minTime={isReservation ? undefined : today} // Permet les dates futures si reservation
              />
            </Box>

            {/* Début de la section prix permanente */}
            {tarifAlert.show && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {tarifAlert.message}
              </Alert>
            )}
            {/* Nouvelle ComboBox sous le champ Price Payed */}

            <FormControl fullWidth>
              <RHCheckBox
                defaultChecked={false}
                name="isPayed"
                label="Payment Status"
              />
            </FormControl>

            {!isLoadingPrices ? (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Select Rate
                </Typography>
                <Grid container spacing={2}>
                  {journalPrices
                    ?.filter((jp) => (isPayed ? priceId === jp.id : true))
                    .map((price) => (
                      <Grid item xs={6} key={price.id}>
                        <PriceCard
                          price={price}
                          isSelected={priceId === price.id}
                          onClick={() => {
                            // setIsManualyUpdating(true);
                            handlePriceSelect(price);
                          }}
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
                disabled={isPayed}
                minTime={registredTime}
              />
            </Box>

            <RHFTextField
              type="number"
              name="payedAmount"
              label="Price Payed (DT)"
              placeholder="Enter amount"
            />

            <FormControl fullWidth>
              <InputLabel>Reservation Status</InputLabel>
              <Select
                value={isReservation ? "reservation" : "non-reservation"}
                onChange={(e) =>
                  setValue("isReservation", e.target.value === "reservation")
                }
                label="Reservation Status"
                sx={{
                  mb: 2,
                  "& .MuiSelect-select": {
                    color: "#054547",
                  },
                }}
              >
                <MenuItem value="non-reservation">Non-Reservation </MenuItem>
                <MenuItem value="reservation">Reservation </MenuItem>
              </Select>
            </FormControl>
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
                <Typography variant="subtitle2">Stayed Duration</Typography>
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
        cursor: "pointer",
        border: isSelected ? "2px solid #054547" : "1px solid #ddd",
        backgroundColor: isSelected ? "#f5f9f9" : "#fff",
        transition: "all 0.3s ease",
        "&:hover": {
          borderColor: "#054547",
          backgroundColor: "#f5f9f9",
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            {price.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ({price.timePeriod.start}-{price.timePeriod.end})
          </Typography>
        </Box>
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
