import prisma from '../src/utils/prisma';

async function deleteUser() {
  const phone = '34640291370';
  console.log(`Deleting user ${phone}...`);
  try {
    // Delete messages first to maintain referential integrity if needed 
    // (though Prisma might handle it if defined, let's be safe)
    await prisma.message.deleteMany({ where: { userPhone: phone } });
    await prisma.receipt.deleteMany({ where: { userPhone: phone } });
    await prisma.user.delete({ where: { phone } });
    console.log('User deleted successfully.');
  } catch (error: any) {
    console.error('Error deleting user:', error.message);
  }
  process.exit();
}

deleteUser();
