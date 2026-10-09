import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();
const notes = [
    ['Road signs', 'Regulatory signs give instructions you must obey; warning signs alert you to hazards; information signs guide you. Learn the shape, colour and meaning of each sign.'],
    ['Right of way', 'Yield where required and approach uncontrolled intersections cautiously. Give way to traffic from the right where the rules require it, and never assume another driver has seen you.'],
    ['Following distance', 'Keep at least a two-second gap in good conditions and increase it in rain, poor visibility, heavy traffic or behind a large vehicle.'],
    ['Alcohol limits', 'The safest choice is never to drive after drinking. South African legal limits are low and differ for professional drivers; medication and fatigue can also impair you.'],
    ['Overtaking rules', 'Overtake only when it is legal and you can see far enough ahead to complete the manoeuvre safely. Never overtake across a solid barrier line or near a crest or blind bend.'],
    ['Roundabouts', 'Reduce speed, choose the correct lane, yield to traffic already in the circle, signal your exit and check for pedestrians and cyclists.'],
    ['Emergency vehicles', 'Make way safely for emergency vehicles using warning lights or sirens. Do not stop where you block an intersection, and check before moving back into traffic.'],
    ['Lane changes', 'Check mirrors, signal in good time, check your blind spot and move only when there is a safe gap. Cancel the signal after the manoeuvre.'],
];

function hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

async function main() {
    for (const [index, [title, body]] of notes.entries()) await prisma.k53Note.upsert({ where: { order: index + 1 }, update: { title, body }, create: { title, body, order: index + 1 } });
    await prisma.user.upsert({
        where: { email: 'admin@driveright.co.za' },
        update: { name: 'DriveRight Admin', phone: '021 555 0100', passwordHash: hashPassword('DriveRightAdmin!2026'), role: 'admin' },
        create: { name: 'DriveRight Admin', email: 'admin@driveright.co.za', phone: '021 555 0100', passwordHash: hashPassword('DriveRightAdmin!2026'), role: 'admin' },
    });
    await prisma.user.upsert({
        where: { email: 'instructor@driveright.co.za' },
        update: { name: 'Thabo Mokoena', phone: '082 555 0101', passwordHash: hashPassword('DriveRightInstructor!2026'), role: 'instructor' },
        create: { name: 'Thabo Mokoena', email: 'instructor@driveright.co.za', phone: '082 555 0101', passwordHash: hashPassword('DriveRightInstructor!2026'), role: 'instructor' },
    });
}

main().finally(() => prisma.$disconnect());
