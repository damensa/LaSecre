import prisma from '../src/utils/prisma';

async function simulateOldUser() {
  const phone = '34640291370';
  console.log(`Simulating old user for ${phone}...`);
  
  // Set createdAt to 31 days ago
  const thirtyOneDaysAgo = new Date();
  thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
  
  try {
    await prisma.user.update({
      where: { phone },
      data: { 
        createdAt: thirtyOneDaysAgo,
        status: 'FREE' 
      }
    });
    console.log(`User ${phone} is now 31 days old in the database.`);
  } catch (error: any) {
    console.error('Error updating user:', error.message);
  }
  process.exit();
}

simulateOldUser();
