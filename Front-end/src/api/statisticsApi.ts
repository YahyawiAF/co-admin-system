import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface RevenueData {
  month: number;
  year: number;
  abonnement: number;
  journal: number;
  dailyProductProfit: number;
  total: number;
}

export interface ExpenseData {
  month: number;
  year: number;
  total: number;
  byType: {
    mensuel: number;
    journalier: number;
  };
}

export interface UsersEvolutionItem {
  month: number;
  year: number;
  count: number;
}

export interface HistoricalDataItem {
  month: number;
  year: number;
  revenue: RevenueData;
  expenses: ExpenseData;
  registrations: { 
    monthlyCount: number;
    total: number;
  };
  memberships: {
    categories: Array<{
      period: string;
      count: number;
    }>;
  };
  mostPresent: Array<{
    firstName?: string;
    lastName?: string;
    email?: string;
    visits: number;
    lastVisit?: string;
  }>;
}

export const fetchHistoricalStats = async (months: number = 12): Promise<{
  usersCount: number;
  historicalData: HistoricalDataItem[];
}> => {
  const response = await axios.get(`${API_BASE_URL}/statistics/historical`, {
    params: { months }
  });
  return response.data;
};

export const fetchMonthlyRevenue = async (month: number, year: number): Promise<RevenueData> => {
  const response = await axios.get(`${API_BASE_URL}/statistics/revenue`, {
    params: { month, year }
  });
  return response.data;
};

export const fetchMonthlyExpenses = async (month: number, year: number): Promise<ExpenseData> => {
  const response = await axios.get(`${API_BASE_URL}/statistics/expenses`, {
    params: { month, year }
  });
  return response.data;
};

export const fetchMonthlyRegistrations = async (month: number, year: number) => {
  const response = await axios.get(`${API_BASE_URL}/statistics/registrations`, {
    params: { month, year }
  });
  return response.data;
};

export const fetchMemberships = async (month: number, year: number) => {
  const response = await axios.get(`${API_BASE_URL}/statistics/memberships`, {
    params: { month, year }
  });
  return response.data;
};

export const fetchUsersCount = async (): Promise<number> => {
  const response = await axios.get(`${API_BASE_URL}/statistics/users-count`);
  return response.data.count;
};

export const fetchUsersEvolution = async (months: number = 12): Promise<UsersEvolutionItem[]> => {
  const response = await axios.get(`${API_BASE_URL}/statistics/users-evolution`, {
    params: { months }
  });
  return response.data;
};

export const fetchMostPresentUsers = async (month: number, year: number, limit: number = 10) => {
  const response = await axios.get(`${API_BASE_URL}/statistics/most-present`, {
    params: { month, year, limit }
  });
  return response.data;
};