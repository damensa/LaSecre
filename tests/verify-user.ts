import prisma from '../src/utils/prisma';

async function checkUser() {
  const user = await prisma.user.findUnique({ where: { phone: '34999000000' } });
  console.log('User registered in DB:', user);
  process.exit();
}

checkUser();
