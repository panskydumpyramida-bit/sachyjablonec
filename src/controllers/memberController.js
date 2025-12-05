import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAllMembers = async (req, res) => {
    try {
        const members = await prisma.member.findMany({
            orderBy: [
                { elo: 'desc' },
                { lastName: 'asc' }
            ]
        });
        res.json(members);
    } catch (error) {
        console.error('Error fetching members:', error);
        res.status(500).json({ error: 'Failed to fetch members' });
    }
};

export const createMember = async (req, res) => {
    try {
        const { firstName, lastName, elo, title, birthYear, role } = req.body;

        if (!firstName || !lastName) {
            return res.status(400).json({ error: 'First name and last name are required' });
        }

        const member = await prisma.member.create({
            data: {
                firstName,
                lastName,
                elo: elo ? parseInt(elo) : null,
                title,
                birthYear: birthYear ? parseInt(birthYear) : null,
                role
            }
        });

        res.status(201).json(member);
    } catch (error) {
        console.error('Error creating member:', error);
        res.status(500).json({ error: 'Failed to create member' });
    }
};

export const updateMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, elo, title, birthYear, role } = req.body;

        const member = await prisma.member.update({
            where: { id: parseInt(id, 10) },
            data: {
                firstName,
                lastName,
                elo: elo ? parseInt(elo) : null,
                title,
                birthYear: birthYear ? parseInt(birthYear) : null,
                role
            }
        });

        res.json(member);
    } catch (error) {
        console.error('Error updating member:', error);
        res.status(500).json({ error: 'Failed to update member' });
    }
};

export const deleteMember = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.member.delete({
            where: { id: parseInt(id, 10) }
        });
        res.json({ message: 'Member deleted successfully' });
    } catch (error) {
        console.error('Error deleting member:', error);
        res.status(500).json({ error: 'Failed to delete member' });
    }
};
