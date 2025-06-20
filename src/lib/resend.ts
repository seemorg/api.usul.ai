import type { CreateEmailOptions } from 'resend';
import { env } from '@/env';
import { render } from '@react-email/render';
import { Resend } from 'resend';

export const resend = new Resend(env.RESEND_API_KEY);

interface ResendEmailOptions extends Omit<CreateEmailOptions, 'to' | 'from'> {
  email: string;
  from?: string;
}

export const sendEmail = async (opts: ResendEmailOptions) => {
  const { email, from: _from, bcc, subject, text, react, scheduledAt } = opts;

  const from = _from || 'noreply@usul.ai';

  if (env.NODE_ENV === 'development' && (text || react)) {
    const emailText =
      text || (await render(react as React.ReactElement, { plainText: true }));
    // log to console
    console.log(`Sending email to ${email} from ${from}`);
    console.log(emailText);
    return;
  }

  return await resend.emails.send({
    to: email,
    from,
    bcc: bcc,
    subject,
    text,
    react,
    scheduledAt,
  });
};
