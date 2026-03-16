import nodemailer from "nodemailer";

interface EmailPayload {
  to: { email: string; name?: string }[];
  subject: string;
  html: string;
  text: string;
}

function createTransport() {
  const host   = process.env.SMTP_HOST     ?? "smtp-relay.brevo.com";
  const port   = parseInt(process.env.SMTP_PORT ?? "587");
  const user   = process.env.SMTP_USER;
  const pass   = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn("[email] SMTP_USER / SMTP_PASS not set — skipping email send.");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: false, // STARTTLS on port 587
    auth: { user, pass },
  });
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const transport = createTransport();
  if (!transport) return;

  const fromEmail = process.env.EMAIL_FROM      ?? "catchjiujitsu@gmail.com";
  const fromName  = process.env.EMAIL_FROM_NAME ?? "Matside";

  await transport.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: payload.to.map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email)).join(", "),
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });
}
