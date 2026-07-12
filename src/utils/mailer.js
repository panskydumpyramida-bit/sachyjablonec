import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

// Lazy initialization - only create Resend when needed
let resend = null;

const getResend = () => {
    if (!resend && process.env.RESEND_API_KEY) {
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
};

export const sendEmail = async (to, subject, html, attachments = null) => {
    // Skip if no API key configured
    if (!process.env.RESEND_API_KEY) {
        console.warn('[Mailer] Resend API key not configured, skipping email');
        return null;
    }

    try {
        console.log(`[Resend] Sending email to ${to} subject: ${subject}`);

        const client = getResend();
        if (!client) {
            console.error('[Resend] Failed to initialize client');
            return null;
        }

        const payload = {
            from: 'Šachový oddíl Bižuterie <notifikace@sachyjablonec.cz>',
            to: [to],
            subject,
            html
        };
        // attachments: [{ filename, content (Buffer | base64 string) }]
        if (attachments && attachments.length) {
            payload.attachments = attachments.map(a => ({
                filename: a.filename,
                content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content,
            }));
        }

        const { data, error } = await client.emails.send(payload);

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
