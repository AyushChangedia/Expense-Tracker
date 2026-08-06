/**
 * Outbound email.
 *
 * Delivery is optional infrastructure, so this module degrades in a defined
 * way rather than failing:
 *
 *   1. `RESEND_API_KEY` set  -> the message is sent over Resend's HTTP API
 *                               (plain `fetch`, no extra dependency).
 *   2. Otherwise             -> the message is logged server-side, and the
 *                               reset link is returned to the caller in
 *                               development so the flow stays testable on a
 *                               fresh clone.
 *
 * The caller never learns whether an address exists — see the sign-in actions.
 */

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult = {
  delivered: boolean;
  provider: "resend" | "console";
};

const FROM_ADDRESS = process.env.EMAIL_FROM ?? "FluxFin <onboarding@resend.dev>";

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.info(
      `[mail] No RESEND_API_KEY configured — logging instead of sending.\n` +
        `  to:      ${input.to}\n` +
        `  subject: ${input.subject}\n` +
        `  ${input.text.replace(/\n/g, "\n  ")}`,
    );
    return { delivered: false, provider: "console" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!response.ok) {
      console.error("[mail] Provider rejected the message:", await response.text());
      return { delivered: false, provider: "resend" };
    }

    return { delivered: true, provider: "resend" };
  } catch (error) {
    console.error("[mail] Failed to reach the email provider:", error);
    return { delivered: false, provider: "resend" };
  }
}

export function passwordResetEmail(resetUrl: string, name?: string | null) {
  const greeting = name ? `Hi ${name},` : "Hi,";

  const text = [
    greeting,
    "",
    "Use the link below to choose a new FluxFin password. It expires in one hour.",
    "",
    resetUrl,
    "",
    "If you did not request this, you can safely ignore this email — your password will not change.",
  ].join("\n");

  const html = `
<div style="background:#08080B;padding:40px 16px;font-family:Inter,system-ui,-apple-system,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:36px;">
    <div style="font-size:22px;font-weight:700;background:linear-gradient(135deg,#7C3AED,#A855F7,#38BDF8);-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:24px;">FluxFin</div>
    <h1 style="color:#FFFFFF;font-size:20px;margin:0 0 12px;">Reset your password</h1>
    <p style="color:#A1A1AA;font-size:14px;line-height:1.6;margin:0 0 24px;">
      ${greeting} use the button below to choose a new password. This link expires in one hour.
    </p>
    <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#7C3AED,#A855F7,#38BDF8);color:#FFFFFF;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:12px;">
      Choose a new password
    </a>
    <p style="color:#71717A;font-size:12px;line-height:1.6;margin:28px 0 0;">
      If the button does not work, paste this into your browser:<br />
      <span style="color:#A1A1AA;word-break:break-all;">${resetUrl}</span>
    </p>
    <p style="color:#71717A;font-size:12px;line-height:1.6;margin:20px 0 0;">
      Did not request this? You can safely ignore this email — your password will not change.
    </p>
  </div>
</div>`.trim();

  return { subject: "Reset your FluxFin password", html, text };
}
