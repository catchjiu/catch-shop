interface EmailPayload {
  to: { email: string; name?: string }[];
  subject: string;
  html: string;
  text: string;
}

/**
 * Send a transactional email via Brevo (formerly Sendinblue).
 * Uses the REST API directly — no extra npm package needed.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("[email] BREVO_API_KEY not set — skipping email send.");
    return;
  }

  const senderEmail = process.env.EMAIL_FROM ?? "catchjiujitsu@gmail.com";
  const senderName = process.env.EMAIL_FROM_NAME ?? "Matside";

  const body = {
    sender: { name: senderName, email: senderEmail },
    to: payload.to,
    subject: payload.subject,
    htmlContent: payload.html,
    textContent: payload.text,
  };

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Brevo API error ${res.status}: ${error}`);
  }
}
