/**
 * Notification Service - Sends alerts to facilities via email/SMS
 * Configuration supports both SendGrid and local testing
 */

const nodemailer = require('nodemailer');

class NotificationService {
  constructor() {
    this.transporter = this.initializeTransporter();
    this.testMode = process.env.NODE_ENV === 'development' || !process.env.SMTP_USER;
  }

  /**
   * Initialize email transporter
   */
  initializeTransporter() {
    // Production: Use SendGrid or SMTP
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }

    // Fallback: Test/development mode (logs to console)
    return {
      sendMail: async (options) => {
        console.log('[NOTIFICATION TEST MODE]', options);
        return { response: 'Logged to console (test mode)' };
      }
    };
  }

  /**
   * Send alert email to facility contact
   * @param {string} email - Recipient email
   * @param {object} alert - Alert data object
   * @param {string} facilityName - Name of the facility
   */
  async sendAlertEmail(email, alert, facilityName = 'Anlegget ditt') {
    try {
      const emailBody = this.generateEmailBody(alert, facilityName);

      const mailOptions = {
        from: process.env.NOTIFICATION_FROM_EMAIL || 'alerts@kystmonitor.no',
        to: email,
        subject: `${alert.severity === 'CRITICAL' ? '🚨 KRITISK' : '⚠️ HØY'} Risiko: ${alert.disease} - ${facilityName}`,
        html: emailBody,
        text: this.generateEmailTextPlain(alert, facilityName)
      };

      const result = await this.transporter.sendMail(mailOptions);

      console.log(`✓ Alert email sent to ${email} for ${facilityName}`);
      return {
        success: true,
        messageId: result.messageId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`✗ Failed to send alert email to ${email}:`, error.message);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Send SMS alert (placeholder for Twilio integration)
   */
  async sendAlertSMS(phoneNumber, alert, facilityName = 'Anlegget') {
    // TODO: Integrate with Twilio
    console.log(`[SMS] To ${phoneNumber}: ${alert.message}`);
    return {
      success: true,
      method: 'SMS',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate HTML email body
   */
  generateEmailBody(alert, facilityName) {
    const levelColors = {
      'KRITISK': '#dc2626',
      'HØY': '#ea580c'
    };

    const levelEmojis = {
      'KRITISK': '🔴',
      'HØY': '🟠'
    };

    const diseaseInfo = {
      'ISA': { name: 'Infeksiøs lakseanemi', color: '#dc2626' },
      'PD': { name: 'Pankreas sjukdom', color: '#ea580c' },
      'PRV': { name: 'Pankreas- og nyreskade virus', color: '#f59e0b' },
      'SRS': { name: 'Saltvannsiktsyndrom', color: '#f59e0b' }
    };

    const disease = diseaseInfo[alert.disease] || { name: alert.disease, color: '#ea580c' };
    const emoji = levelEmojis[alert.riskLevel] || '⚠️';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: ${levelColors[alert.severity] || '#ea580c'}; color: white; padding: 20px; border-radius: 8px; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background-color: #f9fafb; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid ${levelColors[alert.severity] || '#ea580c'}; }
    .risk-score { font-size: 36px; font-weight: bold; color: ${levelColors[alert.severity] || '#ea580c'}; }
    .actions { background-color: #e0f2fe; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .actions h3 { margin-top: 0; color: #0369a1; }
    .actions li { margin: 8px 0; }
    .footer { color: #666; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${emoji} ${alert.severity === 'CRITICAL' ? 'KRITISK VARSEL' : 'RISIKO VARSEL'}</h1>
      <p style="margin: 10px 0 0 0; font-size: 16px;">${disease.name}</p>
    </div>

    <div class="content">
      <h2>${facilityName}</h2>
      
      <p><strong>Situation:</strong></p>
      <p>${alert.message}</p>

      <p><strong>Risiko nivå:</strong></p>
      <div class="risk-score">${alert.riskLevel}</div>
      <p style="color: #666; font-size: 14px;">Risiko-poengsum: <strong>${alert.riskScore}/100</strong></p>

      <p><strong>Sykdom:</strong> ${disease.name}</p>
      <p><strong>Meldt:</strong> ${new Date(alert.timestamp).toLocaleString('no-NO')}</p>
    </div>

    <div class="actions">
      <h3>🛡️ Hva du bør gjøre nå:</h3>
      <ul>
        <li><strong>Øk overvåking:</strong> Kontroller fisk for tegn på sykdom daglig</li>
        <li><strong>Iverksett tiltak:</strong> Implementer biosikkerhetstiltak for å hindre spredning</li>
        <li><strong>Dokumenter:</strong> Noter alle observasjoner og tiltak tatt</li>
        <li><strong>Kontakt Mattilsynet:</strong> Meld fra hvis du observerer sykdomstegn</li>
      </ul>
    </div>

    <p style="color: #666;">
      Dette varselet er automatisk generert basert på ML-analyse av historiske data fra BarentsWatch. 
      Varselet betyr <strong>ØKT RISIKO</strong>, ikke bekrefte sykdom.
    </p>

    <div class="footer">
      <p>Kyst Monitor - Varslingssystem for oppdrettsfiskanlegg</p>
      <p>Timestamp: ${new Date().toISOString()}</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Generate plain text email body
   */
  generateEmailTextPlain(alert, facilityName) {
    const diseaseNames = {
      'ISA': 'Infeksiøs lakseanemi',
      'PD': 'Pankreas sjukdom',
      'PRV': 'Pankreas- og nyreskade virus',
      'SRS': 'Saltvannsiktsyndrom'
    };

    const diseaseName = diseaseNames[alert.disease] || alert.disease;

    return `
RISIKO VARSEL - ${alert.severity === 'CRITICAL' ? 'KRITISK' : 'HØY'}

Anlegg: ${facilityName}
Sykdom: ${diseaseName}
Risiko Nivå: ${alert.riskLevel}
Poengsum: ${alert.riskScore}/100

${alert.message}

Hva du bør gjøre nå:
- Øk overvåking: Kontroller fisk for tegn på sykdom daglig
- Iverksett tiltak: Implementer biosikkerhetstiltak
- Dokumenter: Noter alle observasjoner og tiltak
- Kontakt Mattilsynet: Meld fra hvis du observerer sykdomstegn

Dette varselet baseres på automatisk ML-analyse.
Kyst Monitor - Varslingssystem for oppdrettsfiskanlegg
${new Date().toISOString()}
    `;
  }

  /**
   * Batch send alerts to multiple contacts
   */
  async sendBatchAlerts(alerts, contactsMap) {
    const results = [];

    for (const alert of alerts) {
      const contacts = contactsMap[alert.facilityId] || [];
      
      for (const contact of contacts) {
        if (contact.email) {
          const result = await this.sendAlertEmail(
            contact.email,
            alert,
            contact.facilityName
          );
          results.push({
            alertId: alert.id,
            contact: contact.email,
            ...result
          });
        }

        if (contact.phone && process.env.TWILIO_ENABLED === 'true') {
          const result = await this.sendAlertSMS(
            contact.phone,
            alert,
            contact.facilityName
          );
          results.push({
            alertId: alert.id,
            contact: contact.phone,
            ...result
          });
        }
      }
    }

    return results;
  }

  /**
   * Test notification (for development)
   */
  async sendTestNotification(email) {
    const testAlert = {
      id: 'TEST-001',
      timestamp: new Date().toISOString(),
      disease: 'ISA',
      riskScore: 75,
      riskLevel: 'KRITISK',
      severity: 'CRITICAL',
      message: '🔴 Test varsel: Dette er en test av varslingssystemet.'
    };

    return this.sendAlertEmail(email, testAlert, 'Test Anlegg');
  }
}

module.exports = new NotificationService();
