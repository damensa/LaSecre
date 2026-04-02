import prisma from '../src/utils/prisma';

async function listUsers() {
  const users = await prisma.user.findMany();
  console.log(JSON.stringify(users, null, 2));
  process.exit();
}

listUsers();
