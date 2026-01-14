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

// Get all reports (admin only)
export const getAllReports = async (req, res) => {
    try {
        const reports = await prisma.travelReport.findMany({
            include: {
                user: {
                    select: { id: true, username: true, realName: true, email: true }
                }
            },
            orderBy: { date: 'desc' }
        });
        res.json(reports);
    } catch (error) {
        console.error('Error fetching all travel reports:', error);
        res.status(500).json({ error: 'Error fetching reports' });
    }
};

// Update report status (admin only) - approve or reject
export const updateReportStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, note } = req.body;

        if (!['approved', 'rejected', 'pending'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const report = await prisma.travelReport.update({
            where: { id: parseInt(id) },
            data: { status, note: note || null },
            include: {
                user: {
                    select: { id: true, username: true, realName: true, email: true }
                }
            }
        });

        // Email notification to user about status change
        if (report.user?.email && status !== 'pending') {
            const statusText = status === 'approved' ? 'schválen' : 'zamítnut';
            const statusColor = status === 'approved' ? '#22c55e' : '#ef4444';
            const statusIcon = status === 'approved' ? '✅' : '❌';

            const html = `
                <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: ${statusColor};">${statusIcon} Cestovní příkaz ${statusText}</h2>
                    <p>Váš cestovní příkaz byl ${statusText}.</p>
                    <table style="border-collapse: collapse; margin: 15px 0; background: #f5f5f5; padding: 15px; border-radius: 8px;">
                        <tr><td style="padding: 5px; font-weight: bold;">Datum:</td><td style="padding: 5px;">${new Date(report.date).toLocaleDateString('cs-CZ')}</td></tr>
                        <tr><td style="padding: 5px; font-weight: bold;">Účel:</td><td style="padding: 5px;">${report.purpose}</td></tr>
                        <tr><td style="padding: 5px; font-weight: bold;">Trasa:</td><td style="padding: 5px;">${report.from} → ${report.to}</td></tr>
                        <tr><td style="padding: 5px; font-weight: bold;">Vzdálenost:</td><td style="padding: 5px;">${report.distance} km</td></tr>
                    </table>
                    ${note ? `<p style="color: #666;"><strong>Poznámka:</strong> ${note}</p>` : ''}
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 2rem 0;">
                    <p style="color: #888; font-size: 0.85rem;">Šachový oddíl TJ Bižuterie Jablonec</p>
                </div>
            `;

            sendEmail(
                report.user.email,
                `Cestovní příkaz ${statusText}`,
                html
            ).catch(err => console.error('Failed to send status notification:', err));
        }

        res.json(report);
    } catch (error) {
        console.error('Error updating travel report status:', error);
        res.status(500).json({ error: 'Error updating report' });
    }
};
