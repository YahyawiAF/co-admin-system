import React, { useMemo } from "react";
import styled from "@emotion/styled";
import { withTheme } from "@emotion/react";
import { Line } from "react-chartjs-2";
import { MoreVertical } from "react-feather";

import {
  Card as MuiCard,
  CardContent,
  CardHeader,
  IconButton,
} from "@mui/material";
import { spacing } from "@mui/system";
import { alpha } from "@mui/material/styles";

import { ThemeProps } from "../../../../types/theme";
import { Expense } from "../../../../types/shared";
import Loader from "src/components/Loader";
import { useGetExpensesQuery } from "src/api";

const Card = styled(MuiCard)(spacing);

const ChartWrapper = styled.div`
  height: 200px;
`;

export type ThemePropsWithHeader = ThemeProps;
const filterDays = [1, 5, 10, 15, 20, 25, 30];

const filterDate = (
  expenseDate: Expense[] | undefined,
  monthCondtion: number,
  yearCondition: number
) => {
  return expenseDate
    ? expenseDate
        .sort((a, b) => {
          const dateA = new Date(a.day);
          const dateB = new Date(b.day);

          return dateA.getTime() - dateB.getTime();
        })
        .filter((expense) => {
          const expenseDate = new Date(expense.day);
          const day = expenseDate.getDate();

          return (
            expenseDate.getMonth() + 1 === monthCondtion &&
            expenseDate.getFullYear() === yearCondition &&
            filterDays.includes(day)
          );
        })
    : [];
};

function LineChart({ theme }: ThemePropsWithHeader) {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const { data: expenseData, isLoading, error } = useGetExpensesQuery();

  const expense = useMemo(
    () => (expenseData?.expenses ? [...expenseData?.expenses] : []),
    [expenseData]
  );

  const currentMonthExpenses = useMemo(
    () => filterDate(expense, currentMonth, currentYear),
    [expense, currentMonth, currentYear]
  );

  const previousMonthExpenses = useMemo(
    () => filterDate(expense, previousMonth, previousYear),
    [expense, previousMonth, previousYear]
  );

  const data = useMemo(
    () => ({
      labels: ["1", "5", "10", "15", "20", "25", "30"],
      datasets: [
        {
          label: `Current month (${currentMonth}.${currentYear})`,
          fill: true,
          backgroundColor: function (context: any) {
            const chart = context.chart;
            const { ctx, chartArea } = chart;

            if (!chartArea) {
              return null;
            }

            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(
              0,
              alpha(theme.palette.secondary.main, 0.0875)
            );
            gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

            return gradient;
          },
          borderColor: theme.palette.secondary.main,
          tension: 0.4,
          data: currentMonthExpenses.map((v) => Math.abs(v.value)),
        },
        {
          label: `Previous month (${previousMonth}.${previousYear})`,
          fill: true,
          backgroundColor: "transparent",
          borderColor: theme.palette.grey[500],
          borderDash: [4, 4],
          tension: 0.4,
          data: previousMonthExpenses.map((v) => Math.abs(v.value)),
        },
      ],
    }),
    [
      theme,
      previousMonthExpenses,
      currentMonthExpenses,
      currentMonth,
      currentYear,
      previousMonth,
      previousYear,
    ]
  );

  const options = {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        grid: {
          color: "rgba(0,0,0,0.0)",
        },
      },
      y: {
        grid: {
          color: "rgba(0,0,0,0.0375)",
          fontColor: "#fff",
        },
      },
    },
  };
  if (isLoading) return <Loader />;

  return (
    <Card mb={6}>
      <CardHeader
        action={
          <IconButton aria-label="settings" size="large">
            <MoreVertical />
          </IconButton>
        }
        title="Spending this Month "
      />
      <CardContent>
        <ChartWrapper>
          <Line data={data} options={options} />
        </ChartWrapper>
      </CardContent>
    </Card>
  );
}
export default withTheme(LineChart);
