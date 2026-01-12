import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

// Use Resend API (works on Railway Hobby plan unlike SMTP)
const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async (to, subject, html) => {
    // Skip if no API key configured
    if (!process.env.RESEND_API_KEY) {
        console.warn('Resend API key not configured, skipping email');
        return null;
    }

    try {
        console.log(`[Resend] Sending email to ${to} subject: ${subject}`);

        const { data, error } = await resend.emails.send({
            from: 'Šachový oddíl Bižuterie <noreply@sachyjablonec.cz>',
            to: [to],
            subject,
            html
        });

        if (error) {
            console.error('[Resend] Error:', error);
            return null;
        }

        console.log('[Resend] Message sent:', data.id);
        return data;
    } catch (error) {
        console.error('[Resend] Error sending email:', error);
        return null; // Don't throw to avoid crashing the request
    }
};
