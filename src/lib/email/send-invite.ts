/**
 * Email Sending for Invite System
 * Supports both SMTP (nodemailer) and Resend
 */

import * as nodemailer from "nodemailer"

export interface InviteEmailParams {
  to: string
  inviteCode: string
  inviteLink: string
  customMessage?: string
  inviterName?: string
  expiresAt?: string
}

export interface EmailResult {
  success: boolean
  error?: string
  messageId?: string
}

/**
 * Default invite email template
 */
export const DEFAULT_INVITE_MESSAGE = `You've been invited to join Claudia, an AI-powered development platform that helps you build software faster and smarter.

As a beta tester, you'll get early access to:
- AI-assisted code generation and review
- Intelligent project management
- Automated documentation
- And much more!`

/**
 * Get email transporter based on environment configuration
 */
function getTransporter() {
  // Check for Resend API key first
  if (process.env.RESEND_API_KEY) {
    return {
      type: "resend" as const,
      apiKey: process.env.RESEND_API_KEY,
    }
  }

  // Fall back to SMTP
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      type: "smtp" as const,
      transporter: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      }),
    }
  }

  return null
}

/**
 * Generate the HTML email template for invites
 */
export function generateInviteEmailHtml(params: InviteEmailParams): string {
  const {
    inviteCode,
    inviteLink,
    customMessage,
    inviterName,
    expiresAt,
  } = params

  const message = customMessage || DEFAULT_INVITE_MESSAGE
  const inviterText = inviterName ? `${inviterName} has invited you to` : "You've been invited to"
  const expiryText = expiresAt
    ? `This invite expires on ${new Date(expiresAt).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })}.`
    : ""

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to Claudia</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #e5e5e5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <div style="display: inline-flex; align-items: center; gap: 12px;">
                <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                  <span style="font-size: 24px; font-weight: bold; color: white;">C</span>
                </div>
                <span style="font-size: 28px; font-weight: 700; color: white; letter-spacing: -0.02em;">Claudia</span>
              </div>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td style="background: linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%); border-radius: 16px; border: 1px solid #262626; padding: 40px;">
              <!-- Invitation Header -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: white;">
                      ${inviterText} join Claudia
                    </h1>
                  </td>
                </tr>

                <!-- Custom Message -->
                <tr>
                  <td style="padding-bottom: 32px;">
                    <div style="background: #1f1f1f; border-radius: 12px; padding: 24px; border-left: 4px solid #8b5cf6;">
                      <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #d4d4d4; white-space: pre-wrap;">${message}</p>
                    </div>
                  </td>
                </tr>

                <!-- Invite Code Box -->
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <div style="background: #262626; border-radius: 12px; padding: 20px 32px; display: inline-block;">
                      <p style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #737373;">Your Invite Code</p>
                      <p style="margin: 0; font-size: 32px; font-weight: 700; font-family: 'Monaco', 'Menlo', monospace; color: #8b5cf6; letter-spacing: 0.15em;">${inviteCode}</p>
                    </div>
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: white; text-decoration: none; font-size: 16px; font-weight: 600; padding: 16px 48px; border-radius: 10px; box-shadow: 0 4px 14px rgba(139, 92, 246, 0.4);">
                      Accept Invitation
                    </a>
                  </td>
                </tr>

                <!-- Link Copy -->
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <p style="margin: 0; font-size: 13px; color: #737373;">
                      Or copy this link:
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 13px; color: #8b5cf6; word-break: break-all;">
                      <a href="${inviteLink}" style="color: #8b5cf6; text-decoration: underline;">${inviteLink}</a>
                    </p>
                  </td>
                </tr>

                ${expiryText ? `
                <!-- Expiry Notice -->
                <tr>
                  <td align="center">
                    <p style="margin: 0; font-size: 13px; color: #a3a3a3; background: #1f1f1f; padding: 12px 20px; border-radius: 8px; display: inline-block;">
                      ${expiryText}
                    </p>
                  </td>
                </tr>
                ` : ""}
              </table>
            </td>
          </tr>

          <!-- Features Section -->
          <tr>
            <td style="padding-top: 32px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <p style="margin: 0; font-size: 14px; color: #737373; text-transform: uppercase; letter-spacing: 0.1em;">What you'll get access to</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="width: 50%; padding: 8px; vertical-align: top;">
                          <div style="background: #1a1a1a; border-radius: 12px; padding: 16px; border: 1px solid #262626;">
                            <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: white;">AI Code Generation</p>
                            <p style="margin: 0; font-size: 13px; color: #737373;">Write code faster with intelligent assistance</p>
                          </div>
                        </td>
                        <td style="width: 50%; padding: 8px; vertical-align: top;">
                          <div style="background: #1a1a1a; border-radius: 12px; padding: 16px; border: 1px solid #262626;">
                            <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: white;">Smart Documentation</p>
                            <p style="margin: 0; font-size: 13px; color: #737373;">Auto-generated docs that stay up to date</p>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td style="width: 50%; padding: 8px; vertical-align: top;">
                          <div style="background: #1a1a1a; border-radius: 12px; padding: 16px; border: 1px solid #262626;">
                            <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: white;">Project Management</p>
                            <p style="margin: 0; font-size: 13px; color: #737373;">Organize and track your work effortlessly</p>
                          </div>
                        </td>
                        <td style="width: 50%; padding: 8px; vertical-align: top;">
                          <div style="background: #1a1a1a; border-radius: 12px; padding: 16px; border: 1px solid #262626;">
                            <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: white;">Early Access</p>
                            <p style="margin: 0; font-size: 13px; color: #737373;">Be the first to try new features</p>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 40px; border-top: 1px solid #262626; margin-top: 32px;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #525252;">
                You received this email because someone invited you to Claudia.
              </p>
              <p style="margin: 0; font-size: 13px; color: #525252;">
                Questions? Reply to this email or contact us at <a href="mailto:support@claudiacoder.com" style="color: #8b5cf6; text-decoration: none;">support@claudiacoder.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

/**
 * Generate plain text version of the invite email
 */
export function generateInviteEmailText(params: InviteEmailParams): string {
  const {
    inviteCode,
    inviteLink,
    customMessage,
    inviterName,
    expiresAt,
  } = params

  const message = customMessage || DEFAULT_INVITE_MESSAGE
  const inviterText = inviterName ? `${inviterName} has invited you to` : "You've been invited to"
  const expiryText = expiresAt
    ? `\nThis invite expires on ${new Date(expiresAt).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })}.`
    : ""

  return `
${inviterText} join Claudia
${"=".repeat(50)}

${message}

Your Invite Code: ${inviteCode}

Click here to accept your invitation:
${inviteLink}
${expiryText}

---
What you'll get access to:
- AI Code Generation: Write code faster with intelligent assistance
- Smart Documentation: Auto-generated docs that stay up to date
- Project Management: Organize and track your work effortlessly
- Early Access: Be the first to try new features

---
You received this email because someone invited you to Claudia.
Questions? Contact us at support@claudiacoder.com
`
}

/**
 * Send an invite email using Resend API
 */
async function sendWithResend(
  apiKey: string,
  params: InviteEmailParams
): Promise<EmailResult> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Claudia <noreply@claudiacoder.com>",
        to: [params.to],
        subject: params.inviterName
          ? `${params.inviterName} invited you to join Claudia`
          : "You're invited to join Claudia",
        html: generateInviteEmailHtml(params),
        text: generateInviteEmailText(params),
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.message || "Failed to send email via Resend",
      }
    }

    return {
      success: true,
      messageId: data.id,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error sending email",
    }
  }
}

/**
 * Send an invite email using SMTP (nodemailer)
 */
async function sendWithSmtp(
  transporter: nodemailer.Transporter,
  params: InviteEmailParams
): Promise<EmailResult> {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || "Claudia <noreply@claudiacoder.com>",
      to: params.to,
      subject: params.inviterName
        ? `${params.inviterName} invited you to join Claudia`
        : "You're invited to join Claudia",
      html: generateInviteEmailHtml(params),
      text: generateInviteEmailText(params),
    })

    return {
      success: true,
      messageId: info.messageId,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error sending email",
    }
  }
}

/**
 * Send an invite email
 * Automatically selects between Resend and SMTP based on environment configuration
 */
export async function sendInviteEmail(params: InviteEmailParams): Promise<EmailResult> {
  const transport = getTransporter()

  if (!transport) {
    console.warn("[Email] No email transport configured. Set RESEND_API_KEY or SMTP_* variables.")
    return {
      success: false,
      error: "Email not configured. Please set RESEND_API_KEY or SMTP_HOST, SMTP_USER, SMTP_PASS.",
    }
  }

  if (transport.type === "resend") {
    return sendWithResend(transport.apiKey, params)
  }

  return sendWithSmtp(transport.transporter, params)
}

/**
 * Check if email sending is configured
 */
export function isEmailConfigured(): boolean {
  return !!(
    process.env.RESEND_API_KEY ||
    (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  )
}
