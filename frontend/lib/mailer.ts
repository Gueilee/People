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

const year = new Date().getFullYear();

function emailShell(content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>VENDEMMIA PEOPLE</title>
</head>
<body style="margin:0;padding:0;background-color:#f0ede8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0ede8;min-height:100vh;">
    <tr>
      <td align="center" valign="top" style="padding:40px 16px;">

        <!-- CARD -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- HEADER -->
          <tr>
            <td style="background-color:#422c76;border-radius:14px 14px 0 0;padding:32px 40px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.55);">Sistema de Gestão de Pessoas</p>
                    <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">VENDEMMIA PEOPLE</p>
                  </td>
                  <td align="right" valign="middle">
                    <div style="width:42px;height:42px;background:rgba(255,255,255,0.12);border-radius:50%;text-align:center;line-height:42px;font-size:20px;">👤</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ACCENT LINE -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#ff2f69 0%,#ff6b35 50%,#422c76 100%);line-height:4px;font-size:4px;">&nbsp;</td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 40px 32px;border-radius:0 0 14px 14px;">
              ${content}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="padding:24px 16px 0;">
              <p style="margin:0 0 6px;font-size:11px;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;">VENDEMMIA PEOPLE &nbsp;·&nbsp; Sistema de Gestão de Pessoas</p>
              <p style="margin:0;font-size:10px;color:#c4bfb8;">© ${year} Vendemmia Logística &nbsp;·&nbsp; Este e-mail foi gerado automaticamente, não responda.</p>
            </td>
          </tr>

        </table>
        <!-- /CARD -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendInviteEmail(to: string, nome: string, token: string) {
  const link = `${baseUrl}/definir-senha?token=${token}`;
  const transporter = createTransporter();

  const content = `
    <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ff2f69;">Convite de acesso</p>
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:900;color:#1f2937;line-height:1.2;">Bem-vindo ao<br/>VENDEMMIA PEOPLE</h1>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      <tr>
        <td style="border-left:3px solid #422c76;padding:0 0 0 14px;">
          <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">Olá, <strong style="color:#1f2937;">${nome}</strong>!</p>
          <p style="margin:6px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">Você foi convidado para acessar o painel de gestão de pessoas da Vendemmia.</p>
        </td>
      </tr>
    </table>

    <!-- INFO BOX -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      <tr>
        <td style="background-color:#f3f0fa;border:1.5px solid #d4c8f0;border-radius:10px;padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#8b7bc4;">Seu e-mail de acesso</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:#422c76;">${to}</p>
          <p style="margin:6px 0 0;font-size:12px;color:#9ca3af;">Use este e-mail para entrar no sistema após criar sua senha.</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">Clique no botão abaixo para criar sua senha e começar a usar o sistema:</p>

    <!-- CTA BUTTON -->
    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      <tr>
        <td style="border-radius:10px;background-color:#422c76;box-shadow:0 4px 14px rgba(66,44,118,0.35);">
          <a href="${link}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px;">Criar minha senha →</a>
        </td>
      </tr>
    </table>

    <!-- SEPARATOR -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
      <tr><td style="height:1px;background-color:#f3f4f6;font-size:1px;line-height:1px;">&nbsp;</td></tr>
    </table>

    <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.7;">
      ⏱ Este link é válido por <strong>7 dias</strong>.<br/>
      Se você não esperava este convite, ignore este e-mail — nenhuma ação é necessária.
    </p>
  `;

  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: '🔐 Seu convite de acesso ao VENDEMMIA PEOPLE',
    html: emailShell(content),
  });
}

export async function sendResetEmail(to: string, nome: string, token: string) {
  const link = `${baseUrl}/definir-senha?token=${token}`;
  const transporter = createTransporter();

  const content = `
    <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ff2f69;">Segurança da conta</p>
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:900;color:#1f2937;line-height:1.2;">Redefinição<br/>de senha</h1>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      <tr>
        <td style="border-left:3px solid #422c76;padding:0 0 0 14px;">
          <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">Olá, <strong style="color:#1f2937;">${nome}</strong>!</p>
          <p style="margin:6px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">Recebemos uma solicitação para redefinir a senha da sua conta no VENDEMMIA PEOPLE.</p>
        </td>
      </tr>
    </table>

    <!-- WARNING BOX -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      <tr>
        <td style="background-color:#fff7ed;border:1.5px solid #fed7aa;border-radius:10px;padding:16px 20px;">
          <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
            🔒 &nbsp;Se <strong>você não solicitou</strong> essa redefinição, ignore este e-mail.<br/>
            Sua senha atual permanece ativa e sua conta está segura.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">Para criar uma nova senha, clique no botão abaixo:</p>

    <!-- CTA BUTTON -->
    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      <tr>
        <td style="border-radius:10px;background-color:#422c76;box-shadow:0 4px 14px rgba(66,44,118,0.35);">
          <a href="${link}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px;">Redefinir minha senha →</a>
        </td>
      </tr>
    </table>

    <!-- SEPARATOR -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
      <tr><td style="height:1px;background-color:#f3f4f6;font-size:1px;line-height:1px;">&nbsp;</td></tr>
    </table>

    <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.7;">
      ⏱ Este link expira em <strong>1 hora</strong> por segurança.<br/>
      Caso precise de um novo link, acesse a tela de login e clique em "Esqueci minha senha".
    </p>
  `;

  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: '🔐 Redefinição de senha — VENDEMMIA PEOPLE',
    html: emailShell(content),
  });
}
