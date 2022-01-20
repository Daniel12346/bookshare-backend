import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";

export const transporter = nodemailer.createTransport({
    host: "smtp.mailtrap.io",
    port: 2525,
    auth: {
        user: "ce15d556aa1bca",
        pass: "50eef6a1e931a5"
    }
});