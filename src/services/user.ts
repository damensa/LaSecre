import prisma from '../utils/prisma';
import { normalizePhone, phoneVariants } from '../utils/phone';

export const getUser = async (phone: string) => {
  const normalizedPhone = normalizePhone(phone);
  const variants = Array.from(new Set([normalizedPhone, ...phoneVariants(phone)]));

  const users = await prisma.user.findMany({
    where: { phone: { in: variants } },
    orderBy: { createdAt: 'desc' },
  });

  return users[0] ?? null;
};

export const registerUser = async (phone: string) => {
  const normalizedPhone = normalizePhone(phone);
  try {
    return await prisma.user.create({
      data: {
        phone: normalizedPhone,
        status: 'FREE',
        monthlyCount: 0,
      },
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const existing = await getUser(normalizedPhone);
      if (existing) return existing;
    }
    throw error;
  }
};

export const incrementMonthlyCount = async (phone: string) => {
  const user = await getUser(phone);
  if (!user) throw new Error(`User not found for phone ${phone}`);
  return await prisma.user.update({
    where: { phone: user.phone },
    data: {
      monthlyCount: { increment: 1 },
    },
  });
};

export const updateAccountantEmail = async (phone: string, accountantEmail: string) => {
  const user = await getUser(phone);
  if (!user) throw new Error(`User not found for phone ${phone}`);
  return await prisma.user.update({
    where: { phone: user.phone },
    data: { accountantEmail },
  });
};

export const updateStripeCustomerId = async (phone: string, stripeCustomerId: string) => {
  const user = await getUser(phone);
  if (!user) throw new Error(`User not found for phone ${phone}`);
  return await prisma.user.update({
    where: { phone: user.phone },
    data: { stripeCustomerId },
  });
};

export const updateUserStatus = async (phone: string, status: 'FREE' | 'PAID') => {
  const user = await getUser(phone);
  if (!user) throw new Error(`User not found for phone ${phone}`);
  return await prisma.user.update({
    where: { phone: user.phone },
    data: { status },
  });
};

export const updateFiscalData = async (phone: string, data: { 
  fiscalName?: string, 
  nif?: string, 
  address?: string, 
  postalCode?: string, 
  city?: string 
}) => {
  const user = await getUser(phone);
  if (!user) throw new Error(`User not found for phone ${phone}`);
  return await prisma.user.update({
    where: { phone: user.phone },
    data,
  });
};

export const deleteUser = async (phone: string) => {
  const user = await getUser(phone);
  if (!user) throw new Error(`User not found for phone ${phone}`);
  await (prisma as any).message.deleteMany({ where: { userPhone: user.phone } });
  await (prisma as any).receipt.deleteMany({ where: { userPhone: user.phone } });
  return await prisma.user.delete({
    where: { phone: user.phone },
  });
};

export const getUserByStripeCustomerId = async (stripeCustomerId: string) => {
  return await prisma.user.findUnique({
    where: { stripeCustomerId },
  });
};
