import nodemailer from 'nodemailer';

function createTransporter() {
  const mailerUrl = process.env.MAILER_URL;
  if (mailerUrl) {
    const url = new URL(mailerUrl);
    const p = url.searchParams;
    return nodemailer.createTransport({
      host: url.hostname,
      port: parseInt(url.port || '587'),
      secure: p.get('encryption') === 'ssl',
      auth: {
        user: p.get('username') || decodeURIComponent(url.username),
        pass: p.get('password') || decodeURIComponent(url.password),
      },
      tls: { rejectUnauthorized: false },
    });
  }
  // Fallback: variáveis individuais
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    tls: { rejectUnauthorized: false },
  });
}

function fromAddress() {
  const from = process.env.MAILER_FROM || 'naoresponda@vendemmia.com.br';
  return `"VENDEMMIA PEOPLE" <${from}>`;
}

const baseUrl = process.env.APP_URL || 'https://people.vendemm.ia.br';

export async function sendInviteEmail(to: string, nome: string, token: string, login: string) {
  const link = `${baseUrl}/definir-senha?token=${token}`;
  const transporter = createTransporter();
  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: 'Seu acesso ao VENDEMMIA PEOPLE',
    html: `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f8f9fa;margin:0;padding:20px}
.card{background:#fff;border-radius:12px;padding:32px;max-width:520px;margin:0 auto;box-shadow:0 2px 8px rgba(0,0,0,.08)}
h1{color:#422c76;font-size:20px;margin:0 0 8px}
p{color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px}
.btn{display:inline-block;background:#422c76;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px}
.login-box{background:#f3f0fa;border:1.5px solid #d4c8f0;border-radius:8px;padding:12px 16px;margin:16px 0}
.login-label{font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px}
.login-value{font-size:18px;font-weight:800;color:#422c76;font-family:monospace;margin:0}
.note{font-size:11px;color:#9ca3af;margin-top:24px;border-top:1px solid #f3f4f6;padding-top:16px}
</style></head><body><div class="card">
<h1>Bem-vindo ao VENDEMMIA PEOPLE</h1>
<p>Olá, <strong>${nome}</strong>!</p>
<p>Você foi convidado para acessar o sistema de gestão de pessoas da Vendemmia.</p>
<div class="login-box">
  <p class="login-label">Seu login de acesso</p>
  <p class="login-value">${login}</p>
</div>
<p>Clique no botão abaixo para criar sua senha e acessar o sistema:</p>
<a href="${link}" class="btn">Criar minha senha</a>
<div class="note">
  <p>Este link é válido por 7 dias. Se você não solicitou este acesso, ignore este e-mail.</p>
  <p>VENDEMMIA PEOPLE · Sistema de Gestão de Pessoas</p>
</div>
</div></body></html>`,
  });
}

export async function sendResetEmail(to: string, nome: string, token: string, login: string) {
  const link = `${baseUrl}/definir-senha?token=${token}`;
  const transporter = createTransporter();
  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: 'Redefinição de senha — VENDEMMIA PEOPLE',
    html: `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f8f9fa;margin:0;padding:20px}
.card{background:#fff;border-radius:12px;padding:32px;max-width:520px;margin:0 auto;box-shadow:0 2px 8px rgba(0,0,0,.08)}
h1{color:#422c76;font-size:20px;margin:0 0 8px}
p{color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px}
.btn{display:inline-block;background:#422c76;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px}
.login-box{background:#f3f0fa;border:1.5px solid #d4c8f0;border-radius:8px;padding:12px 16px;margin:16px 0}
.login-label{font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px}
.login-value{font-size:18px;font-weight:800;color:#422c76;font-family:monospace;margin:0}
.note{font-size:11px;color:#9ca3af;margin-top:24px;border-top:1px solid #f3f4f6;padding-top:16px}
</style></head><body><div class="card">
<h1>Redefinição de senha</h1>
<p>Olá, <strong>${nome}</strong>!</p>
<div class="login-box">
  <p class="login-label">Seu login de acesso</p>
  <p class="login-value">${login}</p>
</div>
<p>Recebemos uma solicitação para redefinir a senha da sua conta no VENDEMMIA PEOPLE. Clique no botão abaixo para criar uma nova senha:</p>
<a href="${link}" class="btn">Redefinir minha senha</a>
<div class="note">
  <p>Este link é válido por 1 hora. Se você não solicitou a redefinição de senha, ignore este e-mail — sua senha permanece a mesma.</p>
  <p>VENDEMMIA PEOPLE · Sistema de Gestão de Pessoas</p>
</div>
</div></body></html>`,
  });
}
