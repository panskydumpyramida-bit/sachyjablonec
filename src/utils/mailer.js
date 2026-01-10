import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: {
        rejectUnauthorized: false
    },
    connectionTimeout: 10000, // 10 seconds to connect
    greetingTimeout: 10000,   // 10 seconds for greeting
    socketTimeout: 30000      // 30 seconds for socket operations
});

export const sendEmail = async (to, subject, html) => {
    try {
        console.log(`Sending email to ${to} subject: ${subject}`);
        const info = await transporter.sendMail({
            from: `"Šachový oddíl Bižuterie" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html
        });
        console.log('Message sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        return null; // Don't throw to avoid crashing the request
    }
};
