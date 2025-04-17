import React, { useMemo } from "react";
import styled from "@emotion/styled";
import { useTranslation } from "react-i18next";
import {
  Grid,
  Divider as MuiDivider,
  Typography as MuiTypography,
} from "@mui/material";
import { spacing } from "@mui/system";
import { DollarSign, CreditCard, User } from "react-feather";
import Stats from "../landing/stats";
import { Journal } from "src/types/shared";
import { useGetAbonnementsQuery } from "src/api/abonnement.repo";

const Divider = styled(MuiDivider)(spacing);
const Typography = styled(MuiTypography)(spacing);

function JournalDetails({
  journals,
  isLoading,
  errorMemberReq,
}: {
  journals: Array<Journal>;
  isLoading: boolean;
  errorMemberReq: boolean;
}) {
  const { t } = useTranslation();
  const {
    data: abonnementsData,
    isLoading: isLoadingAbonnements,
    error: errorAbonnements
  } = useGetAbonnementsQuery({ search: "" });

  // Calcul des membres abonnés
  const subscribedMembersCount = useMemo(() => {
    if (!abonnementsData?.data) return 0;
    const uniqueMemberIds = new Set(abonnementsData.data.map(a => a.memberID));
    return uniqueMemberIds.size;
  }, [abonnementsData]);

  // Calcul du total des paiements pour les abonnements
  const cashSubscribedTotal = useMemo(() => {
    if (!abonnementsData?.data) return 0;
    return abonnementsData.data.reduce(
      (acc, curr) => acc + (curr.isPayed ? curr.payedAmount : 0),
      0
    );
  }, [abonnementsData]);

  // Calcul du cash existant + abonnements
  const cashTotal = useMemo(
    () =>
      journals.reduce(
        (acc, curr) => (curr.isPayed ? acc + (curr.payedAmount || 0) : acc),
        0
      ) + cashSubscribedTotal,
    [journals, cashSubscribedTotal]
  );

  if (isLoading || isLoadingAbonnements) return <p>Loading</p>;
  if (errorMemberReq || errorAbonnements) return <p>Error!</p>;

  return (
    <React.Fragment>
      <Grid container spacing={6}>
        <Grid item xs={12} sm={12} md={6} lg={4} xl>
          <Stats
            title="Daily Members"
            count={journals?.length || 0}
            icon={<User />}
          />
        </Grid>
        <Grid item xs={12} sm={12} md={6} lg={4} xl>
          <Stats
            title="Members Subscribed"
            count={subscribedMembersCount}
            icon={<CreditCard />}
          />
        </Grid>
        <Grid item xs={12} sm={12} md={6} lg={4} xl>
          <Stats
            title="Cash"
            count={cashTotal}
            icon={<DollarSign />}
          />
        </Grid>
      </Grid>
    </React.Fragment>
  );
}

export default JournalDetails;