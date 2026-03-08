/**
 * Drip Campaign Example
 * =====================
 * Standalone Node.js script for scheduled broadcast campaigns.
 *
 * Usage:
 *   node scripts/drip-example.js              # Schedule mode (waits for each time slot)
 *   node scripts/drip-example.js --dry-run    # Show schedule without sending
 *   node scripts/drip-example.js --send-now 3 # Send message #3 immediately
 *
 * Key features:
 *   - Idempotency: checks DB before sending (drip_campaign + message_number)
 *   - Crash-safe: each per-student send persisted immediately
 *   - Anti-ban: individual sends with random 3-8s delays
 *   - Late-joiner catch-up: re-sends past messages to new students
 *   - Re-fetches student list before each message
 */

import dotenv from 'dotenv';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
// import { ClawdbotService } from '../src/integrations/ClawdbotService.js';

dotenv.config();

// ─── Campaign Configuration ─────────────────────────────────────────────────

const CAMPAIGN_ID = 'week1-intro';  // Unique ID for idempotency
const COURSE_ID = 'your-course-uuid';

const MESSAGES = [
  {
    number: 1,
    sendAt: new Date('2026-03-01T12:00:00-06:00'),  // Central Time
    content: `*Welcome to the course!* 🎓

Here's your first study tip: [topic overview].

Key takeaway: [one-liner that hooks curiosity].

_Reply to this bot anytime with questions about the course material._`
  },
  {
    number: 2,
    sendAt: new Date('2026-03-01T18:00:00-06:00'),
    content: `*Quick concept check* 📝

[Pose a thought-provoking question about the topic]

Think about it and try to answer before our next class.

_Hint: review [specific resource]._`
  },
  // Add more messages...
];

// ─── Database Connection ─────────────────────────────────────────────────────

const pool = new pg.Pool({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

// ─── Core Functions ──────────────────────────────────────────────────────────

async function getEnrolledStudents() {
  const result = await pool.query(`
    SELECT s.id, s.phone_number, s.name
    FROM students s
    JOIN enrollments e ON e.student_id = s.id
    WHERE e.course_id = $1 AND e.is_active = true AND s.is_active = true
  `, [COURSE_ID]);
  return result.rows;
}

async function wasAlreadySent(messageNumber, studentId) {
  const result = await pool.query(`
    SELECT id FROM messages
    WHERE metadata->>'drip_campaign' = $1
      AND (metadata->>'message_number')::int = $2
      AND metadata->'students_sent_to' ? $3
  `, [CAMPAIGN_ID, messageNumber, studentId]);
  return result.rows.length > 0;
}

async function recordSend(messageNumber, content, studentId) {
  const id = uuidv4();
  await pool.query(`
    INSERT INTO messages (id, sender_type, sender_id, recipient_type, recipient_id,
                          message_type, content, metadata, delivered_at, created_at)
    VALUES ($1, 'system', NULL, 'student', $2, 'broadcast', $3, $4, NOW(), NOW())
    ON CONFLICT DO NOTHING
  `, [id, studentId, content, JSON.stringify({
    drip_campaign: CAMPAIGN_ID,
    message_number: messageNumber,
    students_sent_to: [studentId],
  })]);
}

function randomDelay(minMs, maxMs) {
  return new Promise(resolve =>
    setTimeout(resolve, minMs + Math.random() * (maxMs - minMs))
  );
}

async function sendToStudent(student, content) {
  const personalizedContent = content.replace('{firstName}', student.name?.split(' ')[0] || 'there');

  // Replace with actual ClawdbotService.sendMessage() call:
  // await clawdbot.sendMessage(student.phone_number, personalizedContent);
  console.log(`  → Sent to ${student.name} (${student.phone_number})`);
}

// ─── Main Loop ───────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sendNowIndex = args.indexOf('--send-now');
  const sendNowNumber = sendNowIndex >= 0 ? parseInt(args[sendNowIndex + 1]) : null;

  console.log(`\n📋 Campaign: ${CAMPAIGN_ID}`);
  console.log(`📬 Messages: ${MESSAGES.length}`);

  if (dryRun) {
    console.log('\n🔍 DRY RUN — showing schedule only:\n');
    for (const msg of MESSAGES) {
      console.log(`  #${msg.number} — ${msg.sendAt.toLocaleString()}`);
      console.log(`    ${msg.content.substring(0, 80)}...`);
    }
    process.exit(0);
  }

  for (const msg of MESSAGES) {
    if (sendNowNumber && msg.number !== sendNowNumber) continue;

    // Wait for scheduled time (unless --send-now)
    if (!sendNowNumber) {
      const waitMs = msg.sendAt.getTime() - Date.now();
      if (waitMs > 0) {
        console.log(`\n⏳ Waiting for message #${msg.number} at ${msg.sendAt.toLocaleString()}...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }

    // Re-fetch students (catches late joiners)
    const students = await getEnrolledStudents();
    console.log(`\n📤 Sending message #${msg.number} to ${students.length} students...`);

    let sent = 0, skipped = 0;
    for (const student of students) {
      // Idempotency check
      if (await wasAlreadySent(msg.number, student.id)) {
        skipped++;
        continue;
      }

      await sendToStudent(student, msg.content);
      await recordSend(msg.number, msg.content, student.id);
      sent++;

      // Anti-ban delay (3-8 seconds between sends)
      if (sent < students.length) {
        await randomDelay(3000, 8000);
      }
    }

    console.log(`  ✅ Sent: ${sent}, Skipped (already sent): ${skipped}`);
  }

  console.log('\n🎉 Campaign complete!');
  await pool.end();
}

main().catch(err => {
  console.error('Campaign error:', err);
  process.exit(1);
});
