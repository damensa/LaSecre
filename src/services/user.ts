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
