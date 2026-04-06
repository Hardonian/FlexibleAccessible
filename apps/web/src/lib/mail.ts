import * as nodemailer from "nodemailer";
import { getEmailOutboundSummary } from "@aros/config";

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Sends transactional email when SMTP is fully configured. Otherwise throws — callers must fail closed.
 */
export async function sendTransactionalMail(input: SendMailInput): Promise<void> {
  const summary = getEmailOutboundSummary(process.env);
  if (!summary.configured) {
    throw new Error("outbound_email_not_configured");
  }

  const host = process.env.SMTP_HOST!.trim();
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.EMAIL_FROM!.trim();

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth:
      user && pass
        ? {
            user,
            pass,
          }
        : undefined,
  });

  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html ?? input.text.replace(/\n/g, "<br/>"),
  });
}
