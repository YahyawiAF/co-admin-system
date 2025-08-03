// src/components/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import styled from "@emotion/styled";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import {
  fetchHistoricalStats,
  fetchMonthlyRevenue,
  fetchMonthlyExpenses,
  fetchMonthlyRegistrations,
  fetchMemberships,
  fetchUsersCount,
  fetchMostPresentUsers,
  RevenueData,
  ExpenseData,
  HistoricalDataItem
} from 'src/api/statisticsApi';
import { 
  Box, 
  Grid, 
  Typography, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  CardContent,
  Card as MuiCard,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert
} from '@mui/material';
import { spacing } from '@mui/system';
import { Helmet } from "react-helmet-async";
import DashboardLayout from "../../layouts/Dashboard";
import RoleProtectedRoute from "src/components/auth/ProtectedRoute";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const Card = styled(MuiCard)(spacing);

const ChartWrapper = styled.div`
  height: 300px;
  width: 100%;
`;

interface DashboardData {
  historical: {
    usersCount: number;
    historicalData: HistoricalDataItem[];
  };
  revenue: RevenueData;
  expenses: ExpenseData;
  registrations: HistoricalDataItem['registrations'];
  memberships: HistoricalDataItem['memberships'];
  usersCount: number;
  mostPresent: HistoricalDataItem['mostPresent'];
}

const ChartCard = ({ 
  title, 
  description, 
  children 
}: { 
  title: string; 
  description: string; 
  children: React.ReactNode 
}) => (
  <Card mb={1}>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" gutterBottom>
        {description}
      </Typography>
      <ChartWrapper>
        {children}
      </ChartWrapper>
    </CardContent>
  </Card>
);

const StatCard = ({ 
  title, 
  value,
  isCurrency = false
}: { 
  title: string; 
  value: number;
  isCurrency?: boolean;
}) => (
  <Card mb={1}>
    <CardContent>
      <Typography variant="subtitle2" gutterBottom>
        {title}
      </Typography>
      <Typography variant="h5">
        {isCurrency ? `${value.toLocaleString()} D` : value.toLocaleString()}
      </Typography>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [
          historical,
          revenue,
          expenses,
          registrations,
          memberships,
          usersCount,
          mostPresent
        ] = await Promise.all([
          fetchHistoricalStats(12),
          fetchMonthlyRevenue(selectedMonth, selectedYear),
          fetchMonthlyExpenses(selectedMonth, selectedYear),
          fetchMonthlyRegistrations(selectedMonth, selectedYear),
          fetchMemberships(selectedMonth, selectedYear),
          fetchUsersCount(),
          fetchMostPresentUsers(selectedMonth, selectedYear, 5)
        ]);

        setData({
          historical,
          revenue,
          expenses,
          registrations,
          memberships,
          usersCount,
          mostPresent
        });
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedMonth, selectedYear]);

  if (loading && !data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!data) return null;
  
  // Tooltip safety function
  const safeTooltipLabel = (context: any) => {
    try {
      const label = context.dataset?.label || '';
      const value = context.raw || 0;
      const isCurrency = typeof label === 'string' && label.includes('D');
      return `${label}: ${value}${isCurrency ? ' D' : ''}`;
    } catch (e) {
      return `${context.raw || 0}`;
    }
  };

  // Common chart options with error handling
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: safeTooltipLabel
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => {
            if (typeof value === 'number') {
              return value % 1 === 0 ? value : `${value} D`;
            }
            return value;
          }
        }
      }
    }
  };

  // Options for charts with integers (no D)
  const integerChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `${context.dataset.label}: ${context.raw}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  };

  // Options for circle charts (no axes)
  const circleChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: safeTooltipLabel
        }
      }
    },
    scales: {
      x: {
        display: false,
      },
      y: {
        display: false,
      }
    }
  };

  // 1. Revenue history
  const revenueHistoryData = {
    labels: data.historical.historicalData.map(item => `${item.month}/${item.year}`),
    datasets: [{
      label: 'Total Revenue (D)',
      data: data.historical.historicalData.map(item => item.revenue.total),
      backgroundColor: 'rgba(54, 162, 235, 0.6)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1
    }]
  };

  // 2. Expenses history
  const expensesHistoryData = {
    labels: data.historical.historicalData.map(item => `${item.month}/${item.year}`),
    datasets: [{
      label: 'Total Expenses (D)',
      data: data.historical.historicalData.map(item => item.expenses.total),
      backgroundColor: 'rgba(255, 99, 132, 0.6)',
      borderColor: 'rgba(255, 99, 132, 1)',
      borderWidth: 1
    }]
  };

  // 3. Net profit history
  const netProfitHistoryData = {
    labels: data.historical.historicalData.map(item => `${item.month}/${item.year}`),
    datasets: [{
      label: 'Net Profit (D)',
      data: data.historical.historicalData.map(item => 
        item.revenue.total - item.expenses.total
      ),
      backgroundColor: 'rgba(75, 192, 192, 0.6)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1
    }]
  };

  // 4. Users history
  const usersHistoryData = {
    labels: data.historical.historicalData.map(item => `${item.month}/${item.year}`),
    datasets: [{
      label: 'Total Users',
      data: data.historical.historicalData.map(item => item.registrations.total),
      backgroundColor: 'rgba(201, 203, 207, 0.6)',
      borderColor: 'rgba(201, 203, 207, 1)',
      borderWidth: 1,
      tension: 0.1
    }]
  };

  // 5. Monthly revenue details
  const monthlyRevenueData = {
    labels: ['Subscriptions', 'Daily', 'Products'],
    datasets: [{
      label: 'Revenue (D)',
      data: [
        data.revenue.abonnement,
        data.revenue.journal,
        data.revenue.dailyProductProfit
      ],
      backgroundColor: [
        'rgba(54, 162, 235, 0.6)',
        'rgba(255, 206, 86, 0.6)',
        'rgba(75, 192, 192, 0.6)'
      ],
      borderColor: [
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(75, 192, 192, 1)'
      ],
      borderWidth: 1
    }]
  };

  // 6. Monthly expenses details
  const monthlyExpensesData = {
    labels: ['Monthly Expenses', 'Daily Expenses'],
    datasets: [{
      label: 'Expenses (D)',
      data: [
        data.expenses.byType.mensuel,
        data.expenses.byType.journalier
      ],
      backgroundColor: [
        'rgba(255, 99, 132, 0.6)',
        'rgba(255, 159, 64, 0.6)'
      ],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(255, 159, 64, 1)'
      ],
      borderWidth: 1
    }]
  };

  // 7. Registration history
  const registrationsHistoryData = {
    labels: data.historical.historicalData.map(item => `${item.month}/${item.year}`),
    datasets: [{
      label: 'New Registrations',
      data: data.historical.historicalData.map(item => item.registrations.monthlyCount),
      backgroundColor: 'rgba(153, 102, 255, 0.6)',
      borderColor: 'rgba(153, 102, 255, 1)',
      borderWidth: 1
    }]
  };

  // 8. Memberships distribution
  const membershipsData = {
    labels: data.memberships.categories.map(item => item.period),
    datasets: [{
      data: data.memberships.categories.map(item => item.count),
      backgroundColor: [
        'rgba(255, 99, 132, 0.6)',
        'rgba(54, 162, 235, 0.6)',
        'rgba(255, 206, 86, 0.6)',
        'rgba(75, 192, 192, 0.6)',
        'rgba(153, 102, 255, 0.6)'
      ],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(75, 192, 192, 1)',
        'rgba(153, 102, 255, 1)'
      ],
      borderWidth: 1
    }]
  };

  const tableOptions = {
    style: {
      minWidth: 650,
    },
  };

  // Current statistics
  const currentStats = [
    { name: 'Total Users', value: data.usersCount },
    { name: 'New Members This Month', value: data.registrations.monthlyCount },
    { name: 'Total Revenue', value: data.revenue.total, isCurrency: true },
    { name: 'Total Expenses', value: data.expenses.total, isCurrency: true },
    { name: 'Net Profit', value: data.revenue.total - data.expenses.total, isCurrency: true }
  ];

  return (
    <React.Fragment>
      <Helmet title="Financial Dashboard" />
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Financial Dashboard
        </Typography>

        <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Month</InputLabel>
            <Select
              value={selectedMonth}
              label="Month"
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <MenuItem key={i + 1} value={i + 1}>
                  {new Date(0, i).toLocaleString('en-US', { month: 'long' })}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Year</InputLabel>
            <Select
              value={selectedYear}
              label="Year"
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - i;
                return (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        </Box>

        {loading && (
          <Box display="flex" justifyContent="center" mb={3}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Quick statistics */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {currentStats.map((stat, index) => (
            <Grid item xs={12} sm={6} md={4} lg={2.4} key={index}>
              <StatCard 
                title={stat.name} 
                value={stat.value} 
                isCurrency={stat.isCurrency}
              />
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={3}>
          {/* 1. Revenue history */}
          <Grid item xs={12} md={6}>
            <ChartCard 
              title="Revenue History (12 months)" 
              description="Total revenue evolution over the last 12 months"
            >
              <Bar 
                data={revenueHistoryData} 
                options={chartOptions} 
              />
            </ChartCard>
          </Grid>

          {/* 2. Expenses history */}
          <Grid item xs={12} md={6}>
            <ChartCard 
              title="Expenses History (12 months)" 
              description="Expenses evolution over the last 12 months"
            >
              <Line 
                data={expensesHistoryData} 
                options={chartOptions} 
              />
            </ChartCard>
          </Grid>

          {/* 3. Net profit history */}
          <Grid item xs={12} md={6}>
            <ChartCard 
              title="Net Profit (12 months)" 
              description="Revenue minus expenses over the last 12 months"
            >
              <Bar 
                data={netProfitHistoryData} 
                options={chartOptions} 
              />
            </ChartCard>
          </Grid>

          {/* 4. Users history */}
          <Grid item xs={12} md={6}>
            <ChartCard 
              title="Users Evolution (12 months)" 
              description="Total users over time"
            >
              <Line 
                data={usersHistoryData} 
                options={integerChartOptions} 
              />
            </ChartCard>
          </Grid>

          {/* 5. Monthly revenue details */}
          <Grid item xs={12} md={6}>
            <ChartCard 
              title={`Revenue (${selectedMonth}/${selectedYear})`} 
              description="Revenue breakdown for selected month"
            >
              <Doughnut 
                data={monthlyRevenueData} 
                options={circleChartOptions} 
              />
            </ChartCard>
          </Grid>

          {/* 6. Monthly expenses details */}
          <Grid item xs={12} md={6}>
            <ChartCard 
              title={`Expenses (${selectedMonth}/${selectedYear})`} 
              description="Expenses breakdown for selected month"
            >
              <Pie 
                data={monthlyExpensesData} 
                options={circleChartOptions} 
              />
            </ChartCard>
          </Grid>

          {/* 7. Registration history */}
          <Grid item xs={12} md={6}>
            <ChartCard 
              title="Registration History" 
              description="New registrations over the last 12 months"
            >
              <Line 
                data={registrationsHistoryData} 
                options={integerChartOptions} 
              />
            </ChartCard>
          </Grid>

          {/* 8. Memberships distribution */}
          <Grid item xs={12} md={6}>
            <ChartCard 
              title={`Memberships (${selectedMonth}/${selectedYear})`} 
              description="Membership type distribution"
            >
              <Pie 
                data={membershipsData} 
                options={circleChartOptions} 
              />
            </ChartCard>
          </Grid>

          {/* 9. Most active members */}
          <Grid item xs={12}>
            <Card mb={1}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Most Active Members ({selectedMonth}/{selectedYear})
                </Typography>
                <TableContainer component={Paper}>
                  <Table size="small" sx={tableOptions}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Member</TableCell>
                        <TableCell align="center">Visits</TableCell>
                        <TableCell align="right">Last Visit</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.mostPresent.map((user, index) => (
                        <TableRow key={index}>
                          <TableCell component="th" scope="row">
                            {user.firstName} {user.lastName}
                          </TableCell>
                          <TableCell align="center">{user.visits}</TableCell>
                          <TableCell align="right">
                            {user.lastVisit ? new Date(user.lastVisit).toLocaleDateString() : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </React.Fragment>
  );
};

Dashboard.getLayout = function getLayout(page: React.ReactElement) {
  return (
    <DashboardLayout>
      <RoleProtectedRoute allowedRoles={["ADMIN"]}>{page}</RoleProtectedRoute>
    </DashboardLayout>
  );
};

export default Dashboard;