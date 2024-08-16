import { useMemo } from "react";
import styled from "@emotion/styled";
import { withTheme } from "@emotion/react";
import { MoreVertical } from "react-feather";

import { green, red } from "@mui/material/colors";
import {
  Card as MuiCard,
  CardContent,
  CardHeader,
  IconButton,
  Table,
  TableBody,
  TableCell as MuiTableCell,
  TableHead,
  TableRow as MuiTableRow,
  Typography,
  Avatar,
  Grid,
} from "@mui/material";
import { spacing } from "@mui/system";
import Loader from "src/components/Loader";
import { ThemeProps } from "../../../../types/theme";
import { TransactionRes, Transactions } from "src/types/shared";
import dynamic from "next/dynamic";
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false }) as any;

const Card = styled(MuiCard)(spacing);

const ChartWrapper = styled.div`
  height: 350px;
  width: 100%;
  // position: relative;
`;

const TableRow = styled(MuiTableRow)`
  height: 42px;
`;

const TableCell = styled(MuiTableCell)`
  padding-top: 0;
  padding-bottom: 0;
`;

export type ThemePropsWithHeader = ThemeProps & {
  transactions: TransactionRes | undefined;
  isLoading: boolean;
};

const DoughnutChart = ({
  theme,
  transactions,
  isLoading,
}: ThemePropsWithHeader) => {
  const groupedTransactions: { [key: string]: Transactions } = useMemo(() => {
    if (transactions?.transactions) {
      const groupedTransactionsF = transactions?.transactions.reduce(
        (acc, transaction) => {
          const { creditorName, transactionAmount } = transaction;
          if (
            !acc[creditorName] ||
            Math.abs(parseFloat(acc[creditorName].transactionAmount.amount)) <
              Math.abs(parseFloat(transactionAmount.amount))
          ) {
            acc[creditorName] = transaction;
          }
          return acc;
        },
        {} as { [key: string]: Transactions }
      );

      const sortedGrouped = Object.entries(groupedTransactionsF).sort(
        ([, a], [, b]) => {
          return (
            Math.abs(parseFloat(b.transactionAmount.amount)) -
            Math.abs(parseFloat(a.transactionAmount.amount))
          );
        }
      );
      return Object.fromEntries(sortedGrouped);
    } else return {};
  }, [transactions]);

  const labels = useMemo(
    () => Object.keys(groupedTransactions).map((k) => k),
    [groupedTransactions]
  );

  const data = useMemo(
    () =>
      Object.keys(groupedTransactions)?.map((key, index) =>
        Math.abs(parseFloat(groupedTransactions[key].transactionAmount.amount))
      ),
    [groupedTransactions]
  );

  const options = useMemo(
    () => ({
      dataLabels: {
        enabled: false,
      },
      labels: labels,
      colors: [
        theme.palette.primary.light,
        theme.palette.success.light,
        theme.palette.warning.light,
        theme.palette.error.light,
        theme.palette.info.light,
      ],
    }),
    [labels, theme]
  );
  if (isLoading) return <Loader />;

  return (
    <Card mb={6}>
      <CardHeader
        action={
          <IconButton aria-label="settings" size="large">
            <MoreVertical />
          </IconButton>
        }
        title="Weekly sales"
      />

      <CardContent>
        <ChartWrapper>
          <Chart options={options} series={data} type="donut" height="350" />
        </ChartWrapper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Vendor</TableCell>

              <TableCell align="right">Transaction</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.keys(groupedTransactions)?.map((key, index) => {
              return (
                <TableRow key={index}>
                  <TableCell component="th" scope="row">
                    <Grid
                      container
                      // justifyContent="center"
                      alignItems="center"
                    >
                      <Avatar
                        sx={{ height: "20px", width: "20px", mr: "10px" }}
                        alt="Remy Sharp"
                        src={groupedTransactions[key].avatar}
                      />
                      {key}
                    </Grid>
                  </TableCell>
                  <TableCell align="right">
                    {groupedTransactions[key].transactionAmount.amount}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default withTheme(DoughnutChart);
