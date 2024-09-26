import { Injectable, OnModuleInit } from "@nestjs/common";
import axios from "axios";

import { createTransport, Transporter, TransportOptions } from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import { map } from "rxjs";

export const templates = {
  Wallet_Debit: "1407169904241372254",
  Wallet_Credit: "1407169904219354547",
  Loan_Repayment: "1407169973439056064",
  Recurring_Deposit_Repayment: "1407169904372908628",
  Fixed_Deposit_Approved: "1407169904753505516",
  Loan_Approved_Confirmation: "1407169904496784642",
  Recurring_Deposit_Approved_Confirmation: "1407169904310900942",

  Recurring_Deposit_Maturity: "1407169904442133038",
  Recurring_Deposit_Premature: "1407169904414232750",
  Fixed_Deposit_PreMature: "1407169904781341975",
  Fixed_Deposit_Maturity: "1407169904805690181",

  Loan_Closed_Confirmation: "1407169904609701891",
  Withdrawal_Confirmed: "1407169985751037944",
  Rejected_Reason: "1407169979808096410",

  User_Create: "1407169903961175810",
  User_Create_Confirmation: "1407169985913436678",
  Reset_Password: "1407169904090982059",
};

@Injectable()
export class NotificationService {
  transporter: Transporter<SMTPTransport.SentMessageInfo>;
  readonly BASE_URL = "https://bulksms.bsnl.in:5010/api";

  readonly smtp_host = process.env.SMTP_HOST;
  readonly smtp_port = process.env.SMTP_PORT;
  readonly smtp_user = process.env.SMTP_USER;
  readonly smtp_pass = process.env.SMTP_PASS;

  readonly system_email = process.env.SYSTEM_EMAIL;
  readonly company_name = process.env.COMPANY_NAME;

  constructor() {
    // this.validateEnvironmentVariables();
    this.transporter = createTransport({
      host: this.smtp_host,
      port: this.smtp_port,
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.smtp_user,
        pass: this.smtp_pass,
      },
    } as TransportOptions);
  }

  private validateEnvironmentVariables() {
    const requiredVariables = [
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASS",
      "SYSTEM_EMAIL",
      "COMPANY_NAME",
    ];

    for (const variable of requiredVariables) {
      if (!process.env[variable]) {
        throw new Error(`Missing required environment variable: ${variable}`);
      }
    }
  }

  async sendEmailOTP(email: string, otp: number) {
    try {
      const email_report = await this.transporter.sendMail({
        to: email,
        from: "" + this.company_name + " <" + this.system_email + ">",
        subject: "Please verify your email",
        text:
          "OTP for verifying your" + this.company_name + "account is: " + otp,
        html: `
        <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml">
  
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify your login</title>
    <!--[if mso]><style type="text/css">body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->
  </head>
  
  <body style="font-family: Helvetica, Arial, sans-serif; margin: 0px; padding: 0px; background-color: #ffffff;">
    <table role="presentation"
      style="width: 100%; border-collapse: collapse; border: 0px; border-spacing: 0px; font-family: Arial, Helvetica, sans-serif; background-color: rgb(239, 239, 239);">
      <tbody>
        <tr>
          <td align="center" style="padding: 1rem 2rem; vertical-align: top; width: 100%;">
            <table role="presentation" style="max-width: 600px; border-collapse: collapse; border: 0px; border-spacing: 0px; text-align: left;">
              <tbody>
                <tr>
                  <td style="padding: 40px 0px 0px;">
                    <div style="padding: 20px; background-color: rgb(255, 255, 255);">
                      <div style="color: rgb(0, 0, 0); text-align: center;">
                        <h1 style="margin: 1rem 0">Verification code</h1>
                        <p style="padding-bottom: 16px">Please use the verification code below to sign in.</p>
                        <p style="padding-bottom: 16px"><strong style="font-size: 130%">${otp}</strong></p>
                        <p style="padding-bottom: 16px">If you didn’t request this, you can ignore this email.</p>
                        <p style="padding-bottom: 16px">Thanks,<br>team ${this.company_name}</p>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
  
  </html>`,
      });
      return email_report;
    } catch (e) {
      if (e instanceof Error) {
        console.log(e.message);
      }
    }
  }

  async sendPasswordResetLink(email: string, link: string) {
    try {
      const email_report = await this.transporter.sendMail({
        to: email,
        from: "" + this.company_name + " <" + this.system_email + ">",
        subject: "Reset Your Password",
        text: "Link to reset your password",
        html: `
        <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml">
  
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify your login</title>
    <!--[if mso]><style type="text/css">body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->
  </head>
  
  <body style="font-family: Helvetica, Arial, sans-serif; margin: 0px; padding: 0px; background-color: #ffffff;">
    <table role="presentation"
      style="width: 100%; border-collapse: collapse; border: 0px; border-spacing: 0px; font-family: Arial, Helvetica, sans-serif; background-color: rgb(239, 239, 239);">
      <tbody>
        <tr>
          <td align="center" style="padding: 1rem 2rem; vertical-align: top; width: 100%;">
            <table role="presentation" style="max-width: 600px; border-collapse: collapse; border: 0px; border-spacing: 0px; text-align: left;">
              <tbody>
                <tr>
                  <td style="padding: 40px 0px 0px;">
                    <div style="padding: 20px; background-color: rgb(255, 255, 255);">
                      <div style="color: rgb(0, 0, 0); text-align: center;">
                        <h1 style="margin: 1rem 0">Reset Your Password</h1>
                        <p style="padding-bottom: 16px">Hi 👋,</p>
                        <p style="padding-bottom: 16px">There was a request to change your password!</p>
                        <p style="padding-bottom: 16px">If you did not make this request then please ignore this email.</p>
                        <p style="padding-bottom: 16px">Otherwise, please click this link to change your password: </p><a href="${link}">${link}</a>
                        <p style="padding-bottom: 16px">Thanks,<br>team ${this.company_name}</p>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
  
  </html>`,
      });
      return email_report;
    } catch (e) {
      if (e instanceof Error) {
        console.log(e.message);
      }
    }
  }

  async sendSMS(
    target: string,
    template_id: string,
    values: { Key: string; Value: string }[] = []
  ) {
    try {
      const { data } = await axios.post(
        `${this.BASE_URL}/Send_SMS`,
        {
          Header: process.env.HEADER,
          Target: target,
          Is_Unicode: "0",
          Is_Flash: "0",
          Message_Type: "SI",
          Entity_Id: process.env.ENTITY_Id,
          Content_Template_Id: template_id,
          Consent_Template_Id: null,
          Template_Keys_and_Values: values,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.BRPS_ACCESS_TOKEN}`,
          },
        }
      );

      return data;
    } catch (e) {
      console.log(e);
    }
  }
}
