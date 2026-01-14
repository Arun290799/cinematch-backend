const Contact = require("../models/Contact");
const nodemailer = require("nodemailer");
const host = process.env.EMAIL_SERVER_HOST;
const port = Number(process.env.EMAIL_SERVER_PORT || 587);
const user = process.env.EMAIL_SERVER_USER;
const pass = process.env.EMAIL_SERVER_PASSWORD;
if (!host || !user || !pass) {
	throw new Error("SMTP not configured");
}
const transporter = nodemailer.createTransport({
	host,
	port,
	secure: port === 465,
	auth: {
		user,
		pass,
	},
});

const submitContact = async (req, res) => {
	try {
		const { name, email, message } = req.body;

		// Validate required fields
		if (!name || !email || !message) {
			return res.status(400).json({
				success: false,
				message: "All fields are required",
			});
		}

		// Create contact entry in database
		const contact = new Contact({
			name,
			email,
			message,
		});

		await contact.save();

		// Send email using Nodemailer asynchronously
		// setImmediate(async () => {
		// 	try {
		// 		const emailData = {
		// 			from: process.env.EMAIL_FROM,
		// 			to: process.env.CONTACT_EMAIL || "cinematch913@gmail.com",
		// 			subject: `Contact Form: Message from ${name}`,
		// 			text: `You have received a new contact form submission:\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
		// 			html: `
		// 				<!DOCTYPE html>
		// 				<html>
		// 				<head>
		// 					<meta charset="utf-8">
		// 					<meta name="viewport" content="width=device-width, initial-scale=1.0">
		// 					<title>New Contact Form Submission</title>
		// 					<style>
		// 						body {
		// 							font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		// 							line-height: 1.6;
		// 							color: #333;
		// 							max-width: 600px;
		// 							margin: 0 auto;
		// 							padding: 20px;
		// 							background-color: #f4f4f4;
		// 						}
		// 						.container {
		// 							background-color: #ffffff;
		// 							border-radius: 8px;
		// 							padding: 30px;
		// 							box-shadow: 0 2px 10px rgba(0,0,0,0.1);
		// 						}
		// 						.header {
		// 							text-align: center;
		// 							margin-bottom: 30px;
		// 							padding-bottom: 20px;
		// 							border-bottom: 2px solid #e9ecef;
		// 						}
		// 						.header h1 {
		// 							color: #2c3e50;
		// 							margin: 0;
		// 							font-size: 28px;
		// 							font-weight: 600;
		// 						}
		// 						.header p {
		// 							color: #6c757d;
		// 							margin: 5px 0 0 0;
		// 							font-size: 14px;
		// 						}
		// 						.content {
		// 							margin-bottom: 30px;
		// 						}
		// 						.field-group {
		// 							margin-bottom: 20px;
		// 						}
		// 						.field-label {
		// 							font-weight: 600;
		// 							color: #495057;
		// 							margin-bottom: 5px;
		// 							font-size: 14px;
		// 							text-transform: uppercase;
		// 							letter-spacing: 0.5px;
		// 						}
		// 						.field-value {
		// 							background-color: #f8f9fa;
		// 							padding: 12px 15px;
		// 							border-radius: 6px;
		// 							border-left: 4px solid #007bff;
		// 							font-size: 16px;
		// 							word-wrap: break-word;
		// 						}
		// 						.message-field {
		// 							background-color: #f8f9fa;
		// 							padding: 15px;
		// 							border-radius: 6px;
		// 							border-left: 4px solid #28a745;
		// 							font-size: 16px;
		// 							line-height: 1.6;
		// 							white-space: pre-wrap;
		// 						}
		// 						.footer {
		// 							text-align: center;
		// 							padding-top: 20px;
		// 							border-top: 1px solid #e9ecef;
		// 							color: #6c757d;
		// 							font-size: 12px;
		// 						}
		// 						.brand {
		// 							color: #007bff;
		// 							font-weight: 600;
		// 						}
		// 						.timestamp {
		// 							background-color: #e9ecef;
		// 							padding: 8px 12px;
		// 							border-radius: 4px;
		// 							font-size: 12px;
		// 							color: #6c757d;
		// 							text-align: center;
		// 							margin-bottom: 20px;
		// 						}
		// 					</style>
		// 				</head>
		// 				<body>
		// 					<div class="container">
		// 						<div class="header">
		// 							<h1>🎬 New Contact Form Submission</h1>
		// 							<p>CinemaMatch - Movie Recommendation Platform</p>
		// 						</div>

		// 						<div class="timestamp">
		// 							📅 Received on: ${new Date().toLocaleString("en-US", {
		// 								weekday: "long",
		// 								year: "numeric",
		// 								month: "long",
		// 								day: "numeric",
		// 								hour: "2-digit",
		// 								minute: "2-digit",
		// 							})}
		// 						</div>

		// 						<div class="content">
		// 							<div class="field-group">
		// 								<div class="field-label">👤 Name</div>
		// 								<div class="field-value">${name}</div>
		// 							</div>

		// 							<div class="field-group">
		// 								<div class="field-label">📧 Email Address</div>
		// 								<div class="field-value">
		// 									<a href="mailto:${email}" style="color: #007bff; text-decoration: none;">${email}</a>
		// 								</div>
		// 							</div>

		// 							<div class="field-group">
		// 								<div class="field-label">💬 Message</div>
		// 								<div class="message-field">${message}</div>
		// 							</div>
		// 						</div>

		// 						<div class="footer">
		// 							<p>This message was sent through the <span class="brand">CinemaMatch</span> contact form.</p>
		// 							<p>Please respond to the sender at their provided email address.</p>
		// 						</div>
		// 					</div>
		// 				</body>
		// 				</html>
		// 			`,
		// 		};
		// 		const result = await transporter.sendMail(emailData);
		// 	} catch (emailError) {
		// 		console.error("❌ [EMAIL ERROR] Failed to send email:", emailError);
		// 	}
		// });

		res.status(201).json({
			success: true,
			message: "Contact form submitted successfully",
			data: {
				id: contact._id,
				name: contact.name,
				email: contact.email,
				createdAt: contact.createdAt,
			},
		});
	} catch (error) {
		console.error("Contact submission error:", error);
		res.status(500).json({
			success: false,
			message: "Internal server error",
			error: process.env.NODE_ENV === "development" ? error.message : undefined,
		});
	}
};

module.exports = {
	submitContact,
};
