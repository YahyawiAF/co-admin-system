import { Injectable } from '@nestjs/common';
import { PrismaService } from 'database/prisma.service';
import { endOfMonth, startOfMonth, subMonths } from 'date-fns';

@Injectable()
export class StatisticsService {
  constructor(private prisma: PrismaService) {}

  private async getMonthlyExpenses(startDate: Date, endDate: Date) {
    const expenses = await this.prisma.dailyExpense.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      include: { expense: true },
    });

    const total = expenses.reduce((sum, de) => sum + (de.expense?.amount || 0), 0);
    
    const byType = {
      mensuel: expenses
        .filter(de => de.expense?.type === 'MENSUEL')
        .reduce((sum, de) => sum + (de.expense?.amount || 0), 0),
      journalier: expenses
        .filter(de => de.expense?.type === 'JOURNALIER')
        .reduce((sum, de) => sum + (de.expense?.amount || 0), 0)
    };

    return { total, byType };
  }

  async getMonthlyRevenue(month: number, year: number) {
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    const [
      abonnementRevenue, 
      journalRevenue,
      dailyProductProfit
    ] = await Promise.all([
      this.prisma.abonnement.aggregate({
        _sum: { payedAmount: true },
        where: { 
          registredDate: { gte: startDate, lte: endDate },
          isPayed: true 
        },
      }),
      
      this.prisma.journal.aggregate({
        _sum: { payedAmount: true },
        where: { 
          registredTime: { gte: startDate, lte: endDate },
          isPayed: true 
        },
      }),
      
      this.prisma.dailyProduct.findMany({
        where: { 
          createdAt: { gte: startDate, lte: endDate }
        },
        include: {
          product: {
            select: { 
              sellingPrice: true,
              purchasePrice: true 
            }
          }
        }
      }).then(dailyProducts => {
        return dailyProducts.reduce((profit, dp) => {
          const margin = (dp.product?.sellingPrice || 0) - (dp.product?.purchasePrice || 0);
          return profit + (dp.quantite * margin);
        }, 0);
      })
    ]);

    return {
      month,
      year,
      abonnement: abonnementRevenue._sum.payedAmount || 0,
      journal: journalRevenue._sum.payedAmount || 0,
      dailyProductProfit: dailyProductProfit || 0,
      total: (abonnementRevenue._sum.payedAmount || 0) + 
             (journalRevenue._sum.payedAmount || 0) + 
             (dailyProductProfit || 0)
    };
  }

  async getMonthlyExpensesDetailed(month: number, year: number) {
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));
    return this.getMonthlyExpenses(startDate, endDate);
  }

  async getMonthlyRegistrations(month: number, year: number) {
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    const [monthlyCount, total] = await Promise.all([
      this.prisma.member.count({
        where: { createdAt: { gte: startDate, lte: endDate }, isActive: true },
      }),
      this.prisma.member.count({ where: { isActive: true } }),
    ]);

    return { month, year, monthlyCount, total };
  }

  async getMembershipByCategory(month: number, year: number) {
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    const priceTypes = await this.prisma.price.findMany({
      where: { type: 'abonnement' },
      select: { id: true, name: true },
    });

    const memberships = await this.prisma.abonnement.groupBy({
      by: ['priceId'],
      _count: { id: true },
      where: {
        registredDate: { gte: startDate, lte: endDate },
        isPayed: true,
      },
    });

    const categories = memberships.map(m => {
      const price = priceTypes.find(p => p.id === m.priceId);
      return {
        period: price?.name || 'Inconnu',
        count: m._count.id,
      };
    });

    return { month, year, categories };
  }

  async getUsersCount() {
    return this.prisma.user.count({
      where: { role: 'USER' },
    });
  }

  async getMostPresentUsers(month: number, year: number, limit: number = 10) {
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    const usersPresence = await this.prisma.journal.groupBy({
      by: ['memberID'],
      _count: { id: true },
      where: { registredTime: { gte: startDate, lte: endDate } },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    const memberIds = usersPresence.map(p => p.memberID);
    const members = await this.prisma.member.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    // Get last visit date for each member
    const lastVisits = await Promise.all(
      memberIds.map(memberId => 
        this.prisma.journal.findFirst({
          where: { memberID: memberId },
          orderBy: { registredTime: 'desc' },
          select: { registredTime: true }
        })
      )
    );

    return usersPresence.map((presence, index) => {
      const member = members.find(m => m.id === presence.memberID);
      return {
        ...member,
        visits: presence._count.id,
        lastVisit: lastVisits[index]?.registredTime?.toISOString()
      };
    });
  }

 // Modifier dans StatisticsService
async getHistoricalStats(months: number) {
  const currentDate = new Date();
  const results = [];

  const priceTypes = await this.prisma.price.findMany({
    where: { type: 'abonnement' },
    select: { id: true, name: true },
  });

  // Récupérer l'évolution des utilisateurs une seule fois
  const usersEvolution = await this.getUsersEvolution(months);

  for (let i = 0; i < months; i++) {
    const date = subMonths(currentDate, i);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    const [
      revenue, 
      expenses,
      registrations, 
      membershipsData,
      mostPresent
    ] = await Promise.all([
      this.getMonthlyRevenue(month, year),
      this.getMonthlyExpenses(startDate, endDate),
      this.getMonthlyRegistrations(month, year),
      this.prisma.abonnement.groupBy({
        by: ['priceId'],
        _count: { id: true },
        where: {
          registredDate: { gte: startDate, lte: endDate },
          isPayed: true,
        },
      }),
      this.getMostPresentUsers(month, year),
    ]);

    const memberships = {
      month,
      year,
      categories: membershipsData.map(m => {
        const price = priceTypes.find(p => p.id === m.priceId);
        return {
          period: price?.name || 'Inconnu',
          count: m._count.id,
        };
      })
    };

    // Trouver les données d'évolution correspondantes
    const evolution = usersEvolution.find(e => e.month === month && e.year === year);

    results.push({
      month,
      year,
      revenue,
      expenses,
      registrations: {
        ...registrations,
        total: evolution?.count || 0 // Utiliser le vrai total d'utilisateurs
      },
      memberships,
      mostPresent,
    });
  }

  return {
    usersCount: await this.getUsersCount(),
    historicalData: results.sort((a, b) => 
      new Date(b.year, b.month - 1).getTime() - new Date(a.year, a.month - 1).getTime()
    ),
  };
}

  async getUsersEvolution(months: number) {
  const currentDate = new Date();
  const results = [];
  
  for (let i = 0; i < months; i++) {
    const date = subMonths(currentDate, i);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));
    
    // Compte le nombre d'utilisateurs créés avant la fin de chaque mois
    const count = await this.prisma.user.count({
      where: { 
        createdAt: { lte: endDate },
        role: 'USER'
      }
    });
    
    results.push({ month, year, count });
  }
  
  return results.reverse(); // Pour avoir du plus ancien au plus récent
}
}