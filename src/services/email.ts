import nodemailer from 'nodemailer';
import path from 'path';

export const sendExcelByEmail = async (to: string, filePath: string, phone: string) => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('[Email] Missing SMTP configuration. Email not sent.');
    return false;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587/STARTTLS
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    requireTLS: false,
    name: user.split('@')[1] || 'tusecre.cat',
    authMethod: 'LOGIN',
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    debug: true,
    logger: true,
  });

  const fileName = path.basename(filePath);

  try {
    const info = await transporter.sendMail({
      from: `"TuSecre" <${user}>`,
      to,
      subject: `Resum Trimestral TuSecre - ${phone}`,
      text: `Hola jefe! Aquí t'adjuntem el resum trimestral generat per TuSecre per al número ${phone}.`,
      attachments: [
        {
          filename: fileName,
          path: filePath,
        },
      ],
    });

    console.log('[Email] Message sent: %s', info.messageId);
    return true;
  } catch (error: any) {
    console.error('[Email] FULL ERROR sending email:', error);
    return false;
  }
};
