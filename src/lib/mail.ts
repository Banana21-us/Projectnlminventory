import nodemailer, { type Transporter } from "nodemailer";

// SMTP is optional in dev/self-hosted setups that haven't configured a
// provider yet — every caller must tolerate this silently no-op-ing.
let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.warn(
      "[mail] SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS not set — emails will be skipped.",
    );
    transporter = null;
    return transporter;
  }

  const port = Number(SMTP_PORT);
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Fire-and-forget: logs and returns false instead of throwing when unconfigured or failed. */
export async function sendMail(input: SendMailInput): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;

  try {
    await t.sendMail({
      from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return true;
  } catch (e) {
    console.error("[mail] send failed:", e);
    return false;
  }
}
