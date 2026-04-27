// This file defines an EmailClient class that supports both Resend API and SMTP for sending emails.
// It auto-detects which provider to use based on configured environment variables.
// If RESEND_API_KEY is set, Resend is used. Otherwise, it falls back to SMTP secrets.

import { Resend } from "npm:resend@2.0.0";

interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  cc?: string;
}

interface EmailAttachment {
  filename: string;
  content: Uint8Array;
  contentType: string;
}

export class SMTPClient {
  private smtpConfig: SMTPConfig | null;
  private resendApiKey: string | null;
  private fromEmail: string;
  private fromName: string;
  private useResend: boolean;

  /**
   * Extracts a bare email address from formats like:
   * - "noreply@domain.com" → "noreply@domain.com"
   * - "Name <noreply@domain.com>" → "noreply@domain.com"
   * - "<noreply@domain.com>" → "noreply@domain.com"
   */
  static sanitizeEmail(value: string): string {
    const trimmed = value.trim();
    const match = trimmed.match(/<([^>]+)>/);
    const email = match ? match[1].trim() : trimmed;
    if (!email.includes('@')) {
      throw new Error(
        `Invalid email address: "${value}". Expected format: "email@example.com" or "Name <email@example.com>"`
      );
    }
    return email;
  }

  constructor(options: {
    smtpConfig?: SMTPConfig;
    resendApiKey?: string;
    fromEmail: string;
    fromName: string;
  }) {
    this.smtpConfig = options.smtpConfig || null;
    this.resendApiKey = options.resendApiKey || null;
    this.fromEmail = options.fromEmail;
    this.fromName = options.fromName;
    this.useResend = !!this.resendApiKey;
  }

  static fromEnv(): SMTPClient {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const rawFromEmail = Deno.env.get('SMTP_FROM_EMAIL');
    const fromEmail = rawFromEmail ? SMTPClient.sanitizeEmail(rawFromEmail) : undefined;
    const fromName = Deno.env.get('SMTP_FROM_NAME') || 'Growth OS';

    if (rawFromEmail && rawFromEmail !== fromEmail) {
      console.log(`[EmailClient] Sanitized SMTP_FROM_EMAIL: "${rawFromEmail}" → "${fromEmail}"`);
    }

    // Try Resend first
    if (resendApiKey) {
      if (!fromEmail) {
        throw new Error('SMTP_FROM_EMAIL is required even when using Resend');
      }
      console.log('Email provider: Resend API');
      return new SMTPClient({
        resendApiKey,
        fromEmail,
        fromName,
      });
    }

    // Fall back to SMTP
    const host = Deno.env.get('SMTP_HOST');
    const port = parseInt(Deno.env.get('SMTP_PORT') || '587');
    const username = Deno.env.get('SMTP_USER');
    const password = Deno.env.get('SMTP_PASSWORD');

    if (!host || !username || !password || !fromEmail) {
      throw new Error(
        'Missing email configuration. Set RESEND_API_KEY for Resend, or SMTP_HOST/SMTP_USER/SMTP_PASSWORD/SMTP_FROM_EMAIL for SMTP.'
      );
    }

    console.log('Email provider: SMTP');
    return new SMTPClient({
      smtpConfig: {
        host,
        port,
        username,
        password: password.replace(/\s/g, ''),
        fromEmail,
        fromName,
      },
      fromEmail,
      fromName,
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    if (this.useResend) {
      return this.sendViaResend(options);
    }
    return this.sendViaSMTP(options);
  }

  // ──────────────────────────────────────────────
  // Resend path
  // ──────────────────────────────────────────────

  private async sendViaResend(options: EmailOptions): Promise<void> {
    const { to, subject, html, text, attachments, cc } = options;

    try {
      console.log(`[Resend] Sending email to: ${to}`);
      const resend = new Resend(this.resendApiKey!);

      const payload: Record<string, unknown> = {
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [to],
        subject,
        html,
      };

      if (text) payload.text = text;
      if (cc) payload.cc = [cc];

      if (attachments && attachments.length > 0) {
        payload.attachments = attachments.map((att) => ({
          filename: att.filename,
          content: Array.from(att.content), // Resend accepts number[]
          content_type: att.contentType,
        }));
      }

      const { data, error } = await resend.emails.send(payload as any);

      if (error) {
        console.error('[Resend] API error:', error);
        throw new Error(`Resend API error: ${error.message}`);
      }

      console.log(`[Resend] Email sent successfully to: ${to}`, data);
    } catch (error) {
      console.error('[Resend] Error:', error);
      throw new Error(`Failed to send email to ${to} via Resend: ${error.message}`);
    }
  }

  // ──────────────────────────────────────────────
  // SMTP path (existing logic, untouched)
  // ──────────────────────────────────────────────

  private async sendViaSMTP(options: EmailOptions): Promise<void> {
    const { to, subject, html, text, attachments, cc } = options;
    const config = this.smtpConfig!;
    let conn: Deno.TcpConn | null = null;
    let tlsConn: Deno.TlsConn | null = null;

    try {
      console.log(`[SMTP] Attempting to send email to: ${to}`);

      // Create SMTP connection with timeout
      conn = await Promise.race([
        Deno.connect({
          hostname: config.host,
          port: config.port,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        ),
      ]);

      console.log('[SMTP] Connection established');

      // Convert connection to TLS if needed
      if (config.port === 587 || config.port === 465) {
        tlsConn = await Deno.startTls(conn, { hostname: config.host });
        console.log('[SMTP] TLS connection established');
      } else {
        tlsConn = conn as any;
      }

      const reader = tlsConn.readable.getReader();
      const writer = tlsConn.writable.getWriter();

      // Helper function to read SMTP response with timeout
      const readResponse = async (): Promise<string> => {
        const decoder = new TextDecoder();
        const timeout = setTimeout(() => {
          throw new Error('SMTP response timeout');
        }, 5000);

        try {
          const chunk = await reader.read();
          clearTimeout(timeout);
          if (chunk.value) {
            const response = decoder.decode(chunk.value);
            console.log('[SMTP] Response:', response.trim());
            return response;
          }
          return '';
        } catch (error) {
          clearTimeout(timeout);
          throw error;
        }
      };

      // Helper function to send SMTP command
      const sendCommand = async (command: string) => {
        const encoder = new TextEncoder();
        console.log('[SMTP] Command:', command.replace(/^AUTH LOGIN$|^[A-Za-z0-9+/=]+$/, '[REDACTED]'));
        await writer.write(encoder.encode(command + '\r\n'));
      };

      // SMTP conversation with error checking
      const welcomeResponse = await readResponse();
      if (!welcomeResponse.startsWith('220')) {
        throw new Error(`SMTP server rejected connection: ${welcomeResponse}`);
      }

      // Extract domain from fromEmail or use localhost as fallback
      const domain = config.fromEmail.split('@')[1] || 'localhost';
      await sendCommand(`EHLO ${domain}`);
      const ehloResponse = await readResponse();
      if (!ehloResponse.startsWith('250')) {
        throw new Error(`EHLO failed: ${ehloResponse}`);
      }

      // Start TLS if on port 587
      if (config.port === 587) {
        await sendCommand('STARTTLS');
        const tlsResponse = await readResponse();
        if (!tlsResponse.startsWith('220')) {
          throw new Error(`STARTTLS failed: ${tlsResponse}`);
        }
      }

      // Authentication
      await sendCommand('AUTH LOGIN');
      const authResponse = await readResponse();
      if (!authResponse.startsWith('334')) {
        throw new Error(`AUTH LOGIN failed: ${authResponse}`);
      }

      await sendCommand(btoa(config.username));
      const userResponse = await readResponse();
      if (!userResponse.startsWith('334')) {
        throw new Error(`Username authentication failed: ${userResponse}`);
      }

      await sendCommand(btoa(config.password));
      const passResponse = await readResponse();
      if (!passResponse.startsWith('235')) {
        throw new Error(`Password authentication failed: ${passResponse}`);
      }

      // Send email
      const sanitizedFrom = SMTPClient.sanitizeEmail(config.fromEmail);
      await sendCommand(`MAIL FROM:<${sanitizedFrom}>`);
      const mailResponse = await readResponse();
      if (!mailResponse.startsWith('250')) {
        throw new Error(`MAIL FROM failed: ${mailResponse}`);
      }

      await sendCommand(`RCPT TO:<${to}>`);
      const rcptResponse = await readResponse();
      if (!rcptResponse.startsWith('250')) {
        throw new Error(`RCPT TO failed: ${rcptResponse}`);
      }

      // Add CC recipient if provided
      if (cc) {
        await sendCommand(`RCPT TO:<${cc}>`);
        const ccResponse = await readResponse();
        if (!ccResponse.startsWith('250')) {
          console.warn(`CC recipient failed, continuing without CC: ${ccResponse}`);
        }
      }

      await sendCommand('DATA');
      const dataResponse = await readResponse();
      if (!dataResponse.startsWith('354')) {
        throw new Error(`DATA command failed: ${dataResponse}`);
      }

      // Email headers and body
      const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@${config.fromEmail.split('@')[1]}>`;

      let emailContent: string;

      if (attachments && attachments.length > 0) {
        console.log(`[SMTP] Preparing email with ${attachments.length} attachments`);
        // Multipart email with attachments
        const emailParts = [
          `From: ${config.fromName} <${config.fromEmail}>`,
          `To: ${to}`,
          ...(cc ? [`Cc: ${cc}`] : []),
          `Subject: ${subject}`,
          `Message-ID: ${messageId}`,
          `Date: ${new Date().toUTCString()}`,
          'MIME-Version: 1.0',
          `Content-Type: multipart/mixed; boundary="${boundary}"`,
          `X-Mailer: Growth OS`,
          `X-Priority: 3`,
          '',
          `--${boundary}`,
          'Content-Type: text/html; charset=utf-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          html,
          '',
        ];

        // Add attachments
        for (const attachment of attachments) {
          const base64Content = btoa(String.fromCharCode(...attachment.content));
          emailParts.push(
            `--${boundary}`,
            `Content-Type: ${attachment.contentType}`,
            'Content-Transfer-Encoding: base64',
            `Content-Disposition: attachment; filename="${attachment.filename}"`,
            '',
            base64Content,
            ''
          );
        }

        emailParts.push(`--${boundary}--`);
        emailContent = emailParts.join('\r\n');
      } else {
        // Simple HTML email
        emailContent = [
          `From: ${config.fromName} <${config.fromEmail}>`,
          `To: ${to}`,
          ...(cc ? [`Cc: ${cc}`] : []),
          `Subject: ${subject}`,
          `Message-ID: ${messageId}`,
          `Date: ${new Date().toUTCString()}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=utf-8',
          'Content-Transfer-Encoding: 8bit',
          `X-Mailer: Growth OS`,
          `X-Priority: 3`,
          '',
          html,
        ].join('\r\n');
      }

      await sendCommand(emailContent);
      await sendCommand('.');
      const sendResponse = await readResponse();
      if (!sendResponse.startsWith('250')) {
        throw new Error(`Email sending failed: ${sendResponse}`);
      }

      await sendCommand('QUIT');
      await readResponse();

      console.log(`[SMTP] Email sent successfully to: ${to}`);
    } catch (error) {
      console.error('[SMTP] Error:', error);
      throw new Error(`Failed to send email to ${to} via SMTP: ${error.message}`);
    } finally {
      // Clean up connections in reverse order
      try {
        if (tlsConn && tlsConn !== conn) {
          tlsConn.close();
        }
      } catch (e) {
        console.warn('[SMTP] Error closing TLS connection:', e.message);
      }

      try {
        if (conn) {
          conn.close();
        }
      } catch (e) {
        console.warn('[SMTP] Error closing TCP connection:', e.message);
      }
    }
  }
}
