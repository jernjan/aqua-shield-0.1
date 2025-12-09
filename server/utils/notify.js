import nodemailer from 'nodemailer';

const TWILIO_SID = process.env.TWILIO_SID || '';
const TWILIO_TOKEN = process.env.TWILIO_TOKEN || '';
const TWILIO_PHONE = process.env.TWILIO_PHONE || '';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

let mailTransporter = null;
if (SMTP_USER && SMTP_PASS) {
  mailTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
}

// TODO: In production, implement real Twilio SMS sending
// For MVP: log to console and DB
export async function sendSMS(phone, message) {
  try {
    console.log(`📱 SMS to ${phone}: ${message}`);
    
    // Real Twilio would go here:
    // const twilio = require('twilio');
    // const client = twilio(TWILIO_SID, TWILIO_TOKEN);
    // await client.messages.create({
    //   body: message,
    //   from: TWILIO_PHONE,
    //   to: phone
    // });
    
    return { success: true, message: 'SMS logged (real sending not yet enabled)' };
  } catch (err) {
    console.error('SMS error:', err);
    return { success: false, error: err.message };
  }
}

// TODO: Real email sending (using nodemailer templates)
export async function sendEmail(email, subject, facilityName, riskLevel, details) {
  try {
    if (!mailTransporter) {
      console.log(`📧 Email to ${email} (SMTP not configured): ${subject}`);
      return { success: true, message: 'Email logged (SMTP not configured)' };
    }
    
    const htmlTemplate = `
      <h1>🐟 AquaShield Varsel</h1>
      <p>Hei,</p>
      <p>Vi har registrert <strong>${riskLevel}</strong> smitterisiko for <strong>${facilityName}</strong>.</p>
      <p><strong>Detaljer:</strong> ${details}</p>
      <p>Logg inn på <a href="https://aqua-shield.com/dashboard">dashboardet</a> for mer informasjon.</p>
      <hr/>
      <p>Med vennlig hilsen,<br/>AquaShield Team</p>
    `;
    
    const result = await mailTransporter.sendMail({
      from: SMTP_USER,
      to: email,
      subject: subject,
      html: htmlTemplate
    });
    
    console.log(`✓ Email sent: ${result.messageId}`);
    return { success: true, messageId: result.messageId };
  } catch (err) {
    console.error('Email error:', err);
    return { success: false, error: err.message };
  }
}

// Generate SMS message for facility
export function generateFacilitySMS(facilityName, riskLevel, details) {
  const emoji = riskLevel === 'kritisk' ? '🔴' : '🟡';
  return `${emoji} AquaShield: ${riskLevel.toUpperCase()} smitterisiko på ${facilityName}. ${details.substring(0, 50)}...`;
}

// Generate SMS message for vessel
export function generateVesselSMS(vesselName, facilityName, diseaseType) {
  return `⚠️ AquaShield: ${vesselName} passerte rødsone (${facilityName}: ${diseaseType}). Desinfeksjon anbefalt!`;
}
