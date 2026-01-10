import { PrismaClient } from '@prisma/client';
import { sendEmail } from '../utils/mailer.js';

const prisma = new PrismaClient();

// Get current user's travel reports
export const getMyReports = async (req, res) => {
    try {
        const userId = req.user.id;
        const reports = await prisma.travelReport.findMany({
            where: { userId },
            orderBy: { date: 'desc' }
        });
        res.json(reports);
    } catch (error) {
        console.error('Error fetching travel reports:', error);
        res.status(500).json({ error: 'Error fetching reports' });
    }
};

// Create a new travel report
export const createReport = async (req, res) => {
    try {
        const userId = req.user.id;
        const { date, purpose, from, to, distance, vehicle } = req.body;

        if (!date || !purpose || !from || !to || distance === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const report = await prisma.travelReport.create({
            data: {
                userId,
                date: new Date(date),
                purpose,
                from,
                to,
                distance: parseInt(distance),
                vehicle: vehicle || 'car',
                status: 'pending'
            }
        });

        // Email Notification
        try {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            const admins = await prisma.user.findMany({
                where: { role: { in: ['ADMIN', 'SUPERADMIN'] }, email: { not: null } },
                select: { email: true }
            });

            if (admins.length > 0) {
                const subject = `Nový cestovní příkaz: ${user.realName || user.username}`;
                const html = `
                    <div style="font-family: sans-serif; padding: 20px; color: #333;">
                        <h2 style="color: #0891b2;">Nový cestovní příkaz ke schválení</h2>
                        <p>Člen <strong>${user.realName || user.username}</strong> odeslal nový cestovní příkaz.</p>
                        <table style="border-collapse: collapse; margin: 15px 0;">
                            <tr><td style="padding: 5px; font-weight: bold;">Datum:</td><td style="padding: 5px;">${new Date(date).toLocaleDateString('cs-CZ')}</td></tr>
                            <tr><td style="padding: 5px; font-weight: bold;">Účel:</td><td style="padding: 5px;">${purpose}</td></tr>
                            <tr><td style="padding: 5px; font-weight: bold;">Trasa:</td><td style="padding: 5px;">${from} &rarr; ${to}</td></tr>
                            <tr><td style="padding: 5px; font-weight: bold;">Vzdálenost:</td><td style="padding: 5px;">${distance} km</td></tr>
                            <tr><td style="padding: 5px; font-weight: bold;">Vozidlo:</td><td style="padding: 5px;">${vehicle}</td></tr>
                        </table>
                        <p>Prosím zkontrolujte a schvalte v administraci.</p>
                    </div>
                `;

                admins.forEach(admin => {
                    sendEmail(admin.email, subject, html);
                });
            }
        } catch (emailError) {
            console.error('Failed to send notification emails:', emailError);
            // Non-blocking error
        }

        res.status(201).json(report);
    } catch (error) {
        console.error('Error creating travel report:', error);
        res.status(500).json({ error: 'Error creating report' });
    }
};
