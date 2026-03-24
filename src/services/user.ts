import prisma from '../utils/prisma';

export const getUser = async (phone: string) => {
  return await prisma.user.findUnique({ where: { phone } });
};

export const registerUser = async (phone: string) => {
  return await prisma.user.create({
    data: {
      phone,
      status: 'FREE',
      monthlyCount: 0,
    },
  });
};

export const incrementMonthlyCount = async (phone: string) => {
  return await prisma.user.update({
    where: { phone },
    data: {
      monthlyCount: { increment: 1 },
    },
  });
};

export const updateUserSheet = async (phone: string, sheetId: string) => {
  return await prisma.user.update({
    where: { phone },
    data: { sheetId },
  });
};

export const updateAccountantEmail = async (phone: string, accountantEmail: string) => {
  return await prisma.user.update({
    where: { phone },
    data: { accountantEmail },
  });
};

export const updateStripeCustomerId = async (phone: string, stripeCustomerId: string) => {
  return await prisma.user.update({
    where: { phone },
    data: { stripeCustomerId },
  });
};

export const updateUserStatus = async (phone: string, status: 'FREE' | 'PAID') => {
  return await prisma.user.update({
    where: { phone },
    data: { status },
  });
};

export const getUserByStripeCustomerId = async (stripeCustomerId: string) => {
  return await prisma.user.findUnique({
    where: { stripeCustomerId },
  });
};
