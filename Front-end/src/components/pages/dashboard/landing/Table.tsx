import React, { useMemo, useState } from "react";
import styled from "@emotion/styled";
import { Box, MoreVertical } from "react-feather";

import {
  Card as MuiCard,
  CardHeader,
  IconButton,
  Chip as MuiChip,
  Paper as MuiPaper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Grid,
  Avatar,
  Typography,
  Breadcrumbs as MuiBreadcrumbs,
  Button as MuiButton,
} from "@mui/material";
import { spacing } from "@mui/system";
import Loader from "src/components/Loader";
import { TransactionRes } from "src/types/shared";
const Card = styled(MuiCard)(spacing);

const Chip = styled(MuiChip)`
  height: 20px;
  padding: 4px 0;
  font-size: 90%;
  background-color: ${(props) =>
    props.theme.palette[props.color ? props.color : "primary"].light};
  color: ${(props) => props.theme.palette.common.white};
`;

const Paper = styled(MuiPaper)(spacing);

const TableWrapper = styled.div`
  overflow-y: auto;
  max-width: calc(100vw - ${(props) => props.theme.spacing(12)});
`;

const Button = styled(MuiButton)(spacing);

// Data
let id = 0;

const DashboardTable = ({
  transactions,
  isLoading,
}: {
  transactions: TransactionRes | undefined;
  isLoading: boolean;
}) => {
  const [showCount, setShowCount] = useState(5);

  const transactionsData = useMemo(
    () => (isLoading ? [] : transactions?.transactions || []),
    [transactions, isLoading]
  );

  if (isLoading) return <Loader />;
  else
    return (
      <Card mb={6}>
        <CardHeader
          action={
            <IconButton aria-label="settings" size="large">
              <MoreVertical />
            </IconButton>
          }
          title="Recent Transactions"
        />
        <Paper>
          <TableWrapper>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell>Card</TableCell>
                  <TableCell>Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactionsData.slice(0, showCount).map((row) => (
                  <TableRow key={row.transactionId}>
                    <TableCell component="th" scope="row">
                      {row.valueDate}
                    </TableCell>
                    <TableCell>
                      <Grid
                        container
                        // justifyContent="center"
                        alignItems="center"
                      >
                        <Avatar
                          sx={{ height: "20px", width: "20px", mr: "10px" }}
                          alt="Remy Sharp"
                          src={row.avatar}
                        />
                        <Typography ml={1}>{row.creditorName}</Typography>
                      </Grid>
                    </TableCell>
                    <TableCell>*{row.cardNo}</TableCell>
                    <TableCell>
                      {row.transactionAmount.amount}{" "}
                      {row.transactionAmount.currency}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        </Paper>
        {transactionsData.length > showCount && (
          <Paper m={2}>
            <Button
              onClick={() => setShowCount((prevCount) => prevCount + 5)}
              mr={2}
              variant="outlined"
              size="large"
              color="primary"
            >
              See More
            </Button>
          </Paper>
        )}
      </Card>
    );
};

export default DashboardTable;
