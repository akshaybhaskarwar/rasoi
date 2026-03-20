"""
Email Service Module for Rasoi-Sync
- Gmail SMTP integration for transactional emails
- Password reset emails
- Welcome emails (future)
"""
import os
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# SMTP Configuration
SMTP_EMAIL = os.environ.get('SMTP_EMAIL')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD')
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587

# App Configuration
APP_NAME = "Rasoi-Sync"

def get_frontend_url():
    """Get frontend URL - prioritize env var, fallback to production URL"""
    url = os.environ.get('FRONTEND_URL', '').strip()
    # Always use the production URL if env is empty or contains old values
    if not url or 'rasoi-sync.emergent.host' in url and '-2' not in url:
        return 'https://rasoi-sync-2.emergent.host'
    return url


def is_email_configured() -> bool:
    """Check if email service is properly configured"""
    return bool(SMTP_EMAIL and SMTP_PASSWORD)


async def send_email(to_email: str, subject: str, html_content: str, text_content: str = None) -> bool:
    """
    Send an email using Gmail SMTP
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML body of the email
        text_content: Plain text fallback (optional)
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    if not is_email_configured():
        logger.warning("Email service not configured. Skipping email send.")
        return False
    
    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{APP_NAME} <{SMTP_EMAIL}>"
        message["To"] = to_email
        
        # Add plain text version
        if text_content:
            part1 = MIMEText(text_content, "plain")
            message.attach(part1)
        
        # Add HTML version
        part2 = MIMEText(html_content, "html")
        message.attach(part2)
        
        # Create secure connection and send
        context = ssl.create_default_context()
        
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, message.as_string())
        
        logger.info(f"Email sent successfully to {to_email}")
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP Authentication failed: {e}")
        return False
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error sending email: {e}")
        return False
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


async def send_password_reset_email(to_email: str, reset_token: str, user_name: str = None) -> bool:
    """
    Send password reset email with reset link
    
    Args:
        to_email: User's email address
        reset_token: Password reset token
        user_name: User's name (optional)
    
    Returns:
        bool: True if email sent successfully
    """
    reset_link = f"{get_frontend_url()}/auth?reset_token={reset_token}"
    
    greeting = f"Hi {user_name}," if user_name else "Hi there,"
    
    subject = f"Reset Your {APP_NAME} Password"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #FF9933 0%, #FFB366 100%); padding: 30px; text-align: center;">
                                <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">🍳 {APP_NAME}</h1>
                                <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Your Smart Kitchen Companion</p>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px 30px;">
                                <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 22px; font-weight: 600;">Password Reset Request</h2>
                                
                                <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px; line-height: 1.6;">
                                    {greeting}
                                </p>
                                
                                <p style="margin: 0 0 25px 0; color: #555555; font-size: 16px; line-height: 1.6;">
                                    We received a request to reset your password for your {APP_NAME} account. Click the button below to create a new password:
                                </p>
                                
                                <!-- CTA Button -->
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td align="center" style="padding: 10px 0 30px 0;">
                                            <a href="{reset_link}" style="display: inline-block; background: linear-gradient(135deg, #FF9933 0%, #F59E0B 100%); color: #ffffff; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(255, 153, 51, 0.4);">
                                                Reset Password
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                                
                                <!-- Security Note -->
                                <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; border-radius: 0 8px 8px 0; margin-bottom: 25px;">
                                    <p style="margin: 0; color: #92400E; font-size: 14px; line-height: 1.5;">
                                        <strong>⚠️ Security Note:</strong> This link will expire in 1 hour. If you didn't request this reset, please ignore this email – your password will remain unchanged.
                                    </p>
                                </div>
                                
                                <!-- Alternative Link -->
                                <p style="margin: 0; color: #888888; font-size: 13px; line-height: 1.5;">
                                    If the button doesn't work, copy and paste this link into your browser:
                                </p>
                                <p style="margin: 8px 0 0 0; word-break: break-all; color: #FF9933; font-size: 13px;">
                                    {reset_link}
                                </p>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f9fafb; padding: 25px 30px; border-top: 1px solid #e5e7eb;">
                                <p style="margin: 0; color: #9CA3AF; font-size: 12px; text-align: center; line-height: 1.5;">
                                    This email was sent by {APP_NAME}.<br>
                                    © 2025 Anubandh. All rights reserved.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    text_content = f"""
    {greeting}
    
    We received a request to reset your password for your {APP_NAME} account.
    
    Click the link below to create a new password:
    {reset_link}
    
    This link will expire in 1 hour.
    
    If you didn't request this reset, please ignore this email – your password will remain unchanged.
    
    ---
    {APP_NAME} - Your Smart Kitchen Companion
    © 2025 Anubandh
    """
    
    return await send_email(to_email, subject, html_content, text_content)


async def send_welcome_email(to_email: str, user_name: str) -> bool:
    """
    Send welcome email to new users (future implementation)
    """
    subject = f"Welcome to {APP_NAME}! 🍳"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; overflow: hidden;">
                        <tr>
                            <td style="background: linear-gradient(135deg, #FF9933 0%, #FFB366 100%); padding: 30px; text-align: center;">
                                <h1 style="margin: 0; color: #ffffff; font-size: 28px;">🍳 {APP_NAME}</h1>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 40px 30px;">
                                <h2 style="margin: 0 0 20px 0; color: #333;">Welcome, {user_name}! 🎉</h2>
                                <p style="color: #555; font-size: 16px; line-height: 1.6;">
                                    Your smart kitchen companion is ready to help you:
                                </p>
                                <ul style="color: #555; font-size: 15px; line-height: 1.8;">
                                    <li>📦 Track your pantry inventory</li>
                                    <li>🛒 Create smart shopping lists</li>
                                    <li>📅 Plan meals for the week</li>
                                    <li>🍳 Discover recipes based on what you have</li>
                                </ul>
                                <p style="color: #555; font-size: 16px; line-height: 1.6;">
                                    Start by adding items to your inventory!
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                                <p style="margin: 0; color: #9CA3AF; font-size: 12px;">
                                    © 2025 Anubandh. All rights reserved.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    text_content = f"""
    Welcome to {APP_NAME}, {user_name}!
    
    Your smart kitchen companion is ready to help you:
    - Track your pantry inventory
    - Create smart shopping lists
    - Plan meals for the week
    - Discover recipes based on what you have
    
    Start by adding items to your inventory!
    
    ---
    © 2025 Anubandh
    """
    
    return await send_email(to_email, subject, html_content, text_content)
